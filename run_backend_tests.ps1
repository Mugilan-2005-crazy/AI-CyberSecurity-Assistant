<#
.SYNOPSIS
    run_backend_tests.ps1 - End-to-end validation pipeline.

    0. Ensure infra (MongoDB on 127.0.0.1:27017 + Redis on 127.0.0.1:6379)
    1. Pre-fetch the Jest test file list (used to pinpoint a hanging suite).
    2. Run the backend Jest suite with:
         - LIVE progress streamed every 10 seconds
         - 300s hard maximum runtime (5 min)
         - hang detection (90s of no output) -> kill the process tree
         - exact hanging-test-suite identification + root cause
    3. npm audit --omit=dev
    4. frontend build (npm run build)
    5. Generate validation_report.md

    PowerShell 5.1 compatible. No bash syntax.
#>

$ErrorActionPreference = 'Stop'
$Global:StartTime = [DateTime]::UtcNow

# ----------------------------- configuration ---------------------------------
$Script:Root     = $PSScriptRoot
$Script:Backend  = Join-Path $Script:Root  'backend'
$Script:Frontend = Join-Path $Script:Root  'frontend'
$Script:Work     = Join-Path $Script:Root  '.validation'
New-Item -ItemType Directory -Path $Script:Work -Force | Out-Null

$LogFile     = Join-Path $Script:Work 'backend_tests_output.log'
$AuditFile   = Join-Path $Script:Work 'npm_audit_output.txt'
$BuildFile   = Join-Path $Script:Work 'frontend_build_output.log'
$ResultJson  = Join-Path $Script:Work 'backend_tests_result.json'
$ReportFile  = Join-Path $Script:Root  'validation_report.md'

$MaxTestSeconds   = 300
$PollInterval     = 10
$SilenceThreshold = 90
$AuditTimeoutSec  = 180
$BuildTimeoutSec  = 300
$MongoPort        = 27017
$RedisPort        = 6379

$NodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodeExe) { $NodeExe = 'node' }
  $JestRunner  = Join-Path $Script:Backend 'scripts/runJest.cjs'
  $JestConfig  = Join-Path $Script:Backend 'jest.config.cjs'

# Unbuffered-shim: force Node to flush piped stdout/stderr per write so output is
# streamed live (instead of 16KB bursts) which makes hang detection crisp.
$UnbufShim = Join-Path $Script:Backend '_unbuffered.cjs'
if (-not (Test-Path $UnbufShim)) {
  $shim = @'
// _unbuffered.cjs - force synchronous (line-buffered) writes to piped stdout/stderr.
// Safe no-op when streams are TTY or unavailable.
try {
  var out = process.stdout, err = process.stderr;
  if (out && out._handle && typeof out._handle.setBlocking === 'function') out._handle.setBlocking(true);
  if (err && err._handle && typeof err._handle.setBlocking === 'function') err._handle.setBlocking(true);
} catch (e) {}
'@
  Set-Content -Path $UnbufShim -Value $shim -Encoding UTF8
}

# ----------------------------- helpers ---------------------------------------
function Write-Section($msg) { Write-Host "" ; Write-Host ("=" * 28 + " $msg " + "=" * 28) -ForegroundColor Cyan }
function Write-Info($msg)    { Write-Host "$msg" -ForegroundColor DarkGray }

function Ensure-Container {
  param([string]$Name,[string]$Image,[string]$Port)
  $docker = (Get-Command docker -ErrorAction SilentlyContinue)
  if (-not $docker) { Write-Info "[infra] docker not available; cannot ensure '$Name' on $Port"; return $false }
  if (docker ps -q --filter "name=$Name" 2>$null) { Write-Info "[infra] container '$Name' already running on $Port"; return $true }
  try {
    if (-not (docker image inspect $Image >$null 2>$null)) {
      Write-Info "[infra] pulling $Image ..."
      docker pull $Image >$null 2>$null
    }
    $pmap = "$($Port):$($Port)"
    docker run -d --name $Name -p "$pmap" $Image >$null 2>&1
    Start-Sleep -Seconds 5
    if (docker ps -q --filter "name=$Name") { Write-Info "[infra] started '$Name' ($Image) on $Port"; return $true }
    Write-Info "[infra] FAILED to start '$Name'"; return $false
  } catch { Write-Info "[infra] $Name error: $_"; return $false }
}

function Stop-ProcessTree {
  param([int]$Pid)
  try { Start-Process -FilePath 'taskkill' -ArgumentList "/PID $Pid /T" -Wait -NoNewWindow -ErrorAction SilentlyContinue } catch {}
  try { Start-Process -FilePath 'taskkill' -ArgumentList "/PID $Pid /T /F" -Wait -NoNewWindow -ErrorAction SilentlyContinue } catch {}
}

# Drain captured lines into the log file; return counts + last lines.
function Append-Drain {
  param([System.Collections.Generic.List[string]]$Out,[System.Collections.Generic.List[string]]$Err,[string]$LogFile)
  if ($Out.Count -gt 0) { [System.IO.File]::AppendAllLines($LogFile, $Out, [System.Text.Encoding]::UTF8) }
  if ($Err.Count -gt 0) { [System.IO.File]::AppendAllLines($LogFile, $Err, [System.Text.Encoding]::UTF8) }
  return [pscustomobject]@{
    OutCount = $Out.Count
    ErrCount = $Err.Count
    LastOut  = if ($Out.Count -gt 0) { $Out[$Out.Count-1] } else { '' }
    LastErr  = if ($Err.Count -gt 0) { $Err[$Err.Count-1] } else { '' }
  }
}

# Core protected process runner: live 10s snapshots, hard cap, hang detection.
function Start-MonitoredRun {
  param(
    [Parameter(Mandatory)][string]$Exe,
    [Parameter(Mandatory)][object]$CommandLine,
    [Parameter(Mandatory)][string]$WorkDir,
    [Parameter(Mandatory)][string]$LogFile,
    [int]$TimeoutSec      = 300,
    [int]$StreamInterval  = 10,
    [int]$SilenceTimeout  = 0      # 0 = disabled (hard cap only)
  )

  if ($CommandLine -is [System.Collections.IEnumerable] -and $CommandLine -notis [string]) {
    $CommandLine = [System.String]::Join(' ', @($CommandLine))
  }
  Set-Content -Path $LogFile -Value ''
  $lines    = New-Object System.Collections.Concurrent.ConcurrentBag[string]
  $errLines = New-Object System.Collections.Concurrent.ConcurrentBag[string]
  $shared   = New-Object System.Collections.Concurrent.ConcurrentDictionary[string,object]
  [void]$shared.TryAdd('LastActivity',[DateTime]::UtcNow)
  [void]$shared.TryAdd('TotalOut',0)
  [void]$shared.TryAdd('TotalErr',0)

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName               = $Exe
  $psi.Arguments              = $CommandLine
  $psi.WorkingDirectory       = $WorkDir
  $psi.UseShellExecute        = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.CreateNoWindow         = $true
  $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
  $psi.StandardErrorEncoding  = [System.Text.Encoding]::UTF8

  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi
  $proc.EnableRaisingEvents = $true
  $proc.add_OutputDataReceived({
    param($s,$e)
    if ($null -ne $e.Data) {
      [void]$lines.Add($e.Data)
      $shared['LastActivity'] = [DateTime]::UtcNow
      $shared['TotalOut'] = [int]$shared['TotalOut'] + 1
    }
  })
  $proc.add_ErrorDataReceived({
    param($s,$e)
    if ($null -ne $e.Data) {
      [void]$errLines.Add($e.Data)
      $shared['LastActivity'] = [DateTime]::UtcNow
      $shared['TotalErr'] = [int]$shared['TotalErr'] + 1
    }
  })

  [void]$proc.Start()
  $pid = $proc.Id
  $proc.BeginOutputReadLine()
  $proc.BeginErrorReadLine()
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $killedBy = ''
  $outList = New-Object System.Collections.Generic.List[string]
  $errList = New-Object System.Collections.Generic.List[string]

  while ($true) {
    $exited = $proc.WaitForExit($StreamInterval * 1000)
    $outList.Clear(); $errList.Clear()
    [string]$item = $null
    while ($lines.TryTake([ref]$item)) { $outList.Add($item); $item = $null }
    while ($errLines.TryTake([ref]$item)) { $errList.Add($item); $item = $null }
    $dr = Append-Drain -Out $outList -Err $errList -LogFile $LogFile
    if ($dr.OutCount -gt 0 -or $dr.ErrCount -gt 0) { $shared['LastActivity'] = [DateTime]::UtcNow }

    if ($exited) {
      Write-Info "[done] process exited code=$($proc.ExitCode) after $([int]$sw.Elapsed.TotalSeconds)s"
      break
    }
    $elapsed = [int]$sw.Elapsed.TotalSeconds
    $since   = ([DateTime]::UtcNow - [DateTime]$shared['LastActivity']).TotalSeconds
    Write-Host ("[LIVE t={0}s] pid={1} out={2} err={3} silence={4}s | {5}" -f $elapsed,$pid,$shared['TotalOut'],$shared['TotalErr'],[int]$since,$dr.LastOut) -ForegroundColor DarkCyan
    if ($dr.LastErr) { Write-Host ("                | err:  {0}" -f $dr.LastErr) -ForegroundColor DarkYellow }

    if ($elapsed -ge $TimeoutSec) {
      $killedBy = 'CAP'; Write-Host "[CAP] $TimeoutSec s hard cap reached -> terminating process tree" -ForegroundColor Red; break
    }
    if ($SilenceTimeout -gt 0 -and $since -ge $SilenceTimeout) {
      $killedBy = 'HANG'; Write-Host "[HANG] NO output for $SilenceThreshold s -> terminating process tree" -ForegroundColor Red; break
    }
  }

  if ($killedBy -ne '') {
    Write-Info "[kill] $killedBy : stopping process tree (pid=$pid)"
    Stop-ProcessTree -Pid $pid
    if (-not $proc.HasExited) { try { $proc.Kill() } catch {}; $proc.WaitForExit(3000) }
  }
  # final drain
  $outList.Clear(); $errList.Clear(); [string]$item = $null
  while ($lines.TryTake([ref]$item)) { $outList.Add($item); $item = $null }
  while ($errLines.TryTake([ref]$item)) { $errList.Add($item); $item = $null }
  Append-Drain -Out $outList -Err $errList -LogFile $LogFile

  $exitCode = if ($proc.HasExited) { $proc.ExitCode } else { -1 }
  return [pscustomobject]@{
    Exited   = $proc.HasExited
    ExitCode = $exitCode
    KilledBy = $killedBy
    Elapsed  = [int]$sw.Elapsed.TotalSeconds
    Pid      = $pid
  }
}

function Normalize-Token([string]$p) {
  $p = ($p -replace '/', '\')
  $i = $p.LastIndexOf('tests\')
  if ($i -ge 0) { return $p.Substring($i).ToLowerInvariant() }
  return ([System.IO.Path]::GetFileName($p)).ToLowerInvariant()
}

function Get-HangAnalysis {
  param([string]$LogFile,[string[]]$Planned)
  $log = Get-Content $LogFile -ErrorAction SilentlyContinue
  $completed = New-Object System.Collections.Generic.List[object]
  foreach ($ln in $log) {
    if ($ln -match '^\s*(PASS|FAIL)\s+(.+?)\s*$') {
      $completed.Add([pscustomobject]@{ Result=$matches[1]; Token=Normalize-Token($matches[2].Trim()); Raw=$ln.Trim() })
    }
  }
  $lastCompleted = if ($completed.Count -gt 0) { $completed[$completed.Count-1] } else { $null }
  $hanging = 'unknown'
  if ($lastCompleted) {
    $idx = -1
    for ($i = 0; $i -lt $Planned.Count; $i++) {
      if (Normalize-Token($Planned[$i]) -eq $lastCompleted.Token) { $idx = $i; break }
    }
    if ($idx -ge 0 -and $idx + 1 -lt $Planned.Count) { $hanging = $Planned[$idx + 1] }
    elseif ($idx -ge 0) { $hanging = 'unknown (last completed was the final planned file)' }
  } else {
    if ($Planned.Count -gt 0) { $hanging = $Planned[0] }
  }
  $openH = $log | Where-Object { $_ -match 'open handle|Jest has detected|potentially blocking|Did not log a timeout|outstanding handle' } | Select-Object -Last 10
  return [pscustomobject]@{
    CompletedFiles = @($completed)
    LastCompleted  = $lastCompleted
    HangingFile    = $hanging
    PlannedCount   = $Planned.Count
    OpenHandles    = @($openH)
    LogTail        = @($log | Select-Object -Last 30)
  }
}

# =============================================================================
Write-Section "Validation Pipeline started"
Write-Info "Root    : $Script:Root"
Write-Info "Backend : $Backend"
Write-Info "Frontend: $Frontend"
Write-Info "Node    : $( (node --version 2>$null) )"
Write-Info "npm     : $( (npm --version 2>$null) )"
Write-Info "Workdir : $Work"

# ---------------- Phase 0: ensure infra -------------------------------------
Write-Section "Phase 0: Ensure test infrastructure (MongoDB + Redis)"
$env:MONGODB_URI  = 'mongodb://127.0.0.1:27017/cybersec_test'
$env:REDIS_HOST   = 'localhost'
$env:REDIS_PORT   = '6379'
$env:OTEL_ENABLED = 'false'
$env:NODE_ENV     = 'test'

$monoOk = Ensure-Container -Name 'cs-mongo' -Image 'mongo:7.0' -Port $MongoPort
$rdsOk  = Ensure-Container -Name 'cs-redis' -Image 'redis:7'   -Port $RedisPort

$mongoReachable = $false
if ($monoOk) {
  Write-Info "[infra] waiting for MongoDB to accept connections ..."
  $sw0 = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw0.Elapsed.TotalSeconds -lt 20) {
    try { [void][System.Net.Sockets.TcpClient]::new().Connect('127.0.0.1',$MongoPort); $mongoReachable = $true; break }
    catch { Start-Sleep -Milliseconds 500 }
  }
}
Write-Info "[infra] MongoDB reachable   : $mongoReachable"
Write-Info "[infra] Redis container      : $rdsOk"

# ---------------- Phase 1: backend tests ------------------------------------
Write-Section "Phase 1: Backend Jest tests (runInBand, verbose, detectOpenHandles, --coverage)"

Write-Info "[tests] fetching test file list (jest --listTests) ..."
try {
  $plannedRaw = & $NodeExe "$JestRunner" --config "$JestConfig" --listTests 2>&1
} catch {
  Write-Info "[tests] jest --listTests error: $_"
  $plannedRaw = @()
}
$plannedTests = @($plannedRaw | Where-Object { $_ -match '\.test\.mjs$' })
Write-Info "[tests] planned test files: $($plannedTests.Count)"

  $testArgs = [System.String]::Join(' ', @('--require', $UnbufShim, "$JestRunner", '--config', $JestConfig, '--runInBand', '--verbose', '--detectOpenHandles', '--forceExit', '--coverage'))
Write-Info "[tests] command: $NodeExe $testArgs"
Write-Info "[tests] max runtime=$MaxTestSeconds s | stream every $PollInterval s | hang if silent > $SilenceThreshold s"

$testResult = Start-MonitoredRun -Exe $NodeExe -CommandLine @('--require', $UnbufShim, "$JestRunner", '--config', $JestConfig, '--runInBand', '--verbose', '--detectOpenHandles', '--forceExit', '--coverage') -WorkDir $Backend -LogFile $LogFile -TimeoutSec $MaxTestSeconds -StreamInterval $PollInterval -SilenceTimeout $SilenceThreshold

$logLines  = Get-Content $LogFile -ErrorAction SilentlyContinue
$testsLine   = ($logLines | Where-Object { $_ -match '^\s*Tests:' }        | Select-Object -Last 1)
$suitesLine  = ($logLines | Where-Object { $_ -match '^\s*Test Suites:' } | Select-Object -Last 1)
$timeLine    = ($logLines | Where-Object { $_ -match 'Time:' }            | Select-Object -Last 1)

$hangInfo = $null
if ($testResult.KilledBy -ne '') { $hangInfo = Get-HangAnalysis -LogFile $LogFile -Planned $plannedTests }
$testsPassed = ($testResult.KilledBy -eq '') -and ($testResult.ExitCode -eq 0)

$resultObj = [ordered]@{
  pipelineStarted       = ([DateTime]$Global:StartTime).ToString('o')
  nodeVersion           = (node --version 2>$null)
  npmVersion            = (npm --version 2>$null)
  env                   = @{ MONGODB_URI = $env:MONGODB_URI; REDIS_HOST = $env:REDIS_HOST; OTEL_ENABLED = $env:OTEL_ENABLED; NODE_ENV = $env:NODE_ENV }
  mongoReachable        = $mongoReachable
  redisContainerRunning = $rdsOk
  plannedTestCount      = $plannedTests.Count
  testCommand           = "$NodeExe $testArgs"
  exitCode              = $testResult.ExitCode
  fullyExited           = $testResult.Exited
  killedBy              = $testResult.KilledBy
  elapsedSeconds        = $testResult.Elapsed
  testsPassed           = $testsPassed
  jestTestsLine         = $testsLine
  jestSuitesLine        = $suitesLine
  jestTimeLine          = $timeLine
  hangingSuite          = if ($hangInfo) { $hangInfo.HangingFile } else { $null }
  lastCompletedSuite    = if ($hangInfo) { if ($hangInfo.LastCompleted) { $hangInfo.LastCompleted.Raw } else { $null } } else { $null }
  openHandles           = if ($hangInfo) { $hangInfo.OpenHandles } else { @() }
  completedSuites       = if ($hangInfo) { $hangInfo.CompletedFiles } else { @() }
  logFile               = $LogFile
}
$resultObj | ConvertTo-Json -Depth 5 | Set-Content -Path $ResultJson -Encoding UTF8

Write-Section "Backend test result"
if ($testsPassed) {
  Write-Host "[RESULT] BACKEND TESTS PASSED (exit 0, $([int]$testResult.Elapsed)s)" -ForegroundColor Green
} elseif ($testResult.KilledBy -eq 'HANG') {
  Write-Host "[RESULT] BACKEND TESTS HUNG -> terminated after $([int]$testResult.Elapsed)s" -ForegroundColor Red
  if ($hangInfo) {
    Write-Host "[HANG] suite still running: $($hangInfo.HangingFile)" -ForegroundColor Red
    Write-Host "[HANG] last completed suite: $(if($hangInfo.LastCompleted){$hangInfo.LastCompleted.Raw} else {'<none>'})" -ForegroundColor Red
  }
} elseif ($testResult.KilledBy -eq 'CAP') {
  Write-Host "[RESULT] BACKEND TESTS did not finish within $MaxTestSeconds s -> terminated" -ForegroundColor Red
  if ($hangInfo) { Write-Host "[CAP] in-progress suite at termination: $($hangInfo.HangingFile)" -ForegroundColor Red }
} else {
  Write-Host "[RESULT] BACKEND TESTS FAILED (jest exit=$($testResult.ExitCode), $([int]$testResult.Elapsed)s)" -ForegroundColor Red
}
Write-Info "Tests line : $testsLine"
Write-Info "Suites line: $suitesLine"
Write-Info "Log file   : $LogFile"
Write-Info "Result json: $ResultJson"

# ---------------- Phase 2: npm audit ----------------------------------------
Write-Section "Phase 2: npm audit --omit=dev"
$auditResult = $null
try {
  $auditResult = Start-MonitoredRun -Exe 'cmd' -CommandLine '/c npm audit --omit=dev' -WorkDir $Backend -LogFile $AuditFile -TimeoutSec $AuditTimeoutSec -StreamInterval $PollInterval -SilenceTimeout 0
  Write-Info "[audit] exit=$($auditResult.ExitCode) elapsed=$($auditResult.Elapsed)s killedBy=$($auditResult.KilledBy)"
} catch {
  Write-Info "[audit] ERROR: $_"
  $auditResult = [pscustomobject]@{ Exited=$false; ExitCode=-1; KilledBy='ERROR'; Elapsed=0; Pid=$null }
}
$auditText  = Get-Content $AuditFile -ErrorAction SilentlyContinue
$auditFound = ($auditText | Select-String -Pattern 'found\s+(\d+)\s+vulnerabilities?' -AllMatches | Select-Object -Last 1)
$auditSummary = if ($auditFound) { $auditFound.Line.Trim() } else { '(severity summary not captured in text output)' }
Write-Info "[audit] summary: $auditSummary"

# ---------------- Phase 3: frontend build -----------------------------------
Write-Section "Phase 3: frontend build (npm run build)"
$env:NODE_ENV = 'production'
$buildResult = $null
try {
  $buildResult = Start-MonitoredRun -Exe 'cmd' -CommandLine '/c npm run build' -WorkDir $Frontend -LogFile $BuildFile -TimeoutSec $BuildTimeoutSec -StreamInterval $PollInterval -SilenceTimeout 0
  Write-Info "[build] exit=$($buildResult.ExitCode) elapsed=$($buildResult.Elapsed)s killedBy=$($buildResult.KilledBy)"
} catch {
  Write-Info "[build] ERROR: $_"
  $buildResult = [pscustomobject]@{ Exited=$false; ExitCode=-1; KilledBy='ERROR'; Elapsed=0; Pid=$null }
}
$buildText = Get-Content $BuildFile -ErrorAction SilentlyContinue
$buildOk = ($buildResult.ExitCode -eq 0)
$distSize = 0
try {
  if (Test-Path (Join-Path $Frontend 'dist')) {
    $distSize = [long]((Get-ChildItem (Join-Path $Frontend 'dist') -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Sum Length).Sum)
  }
} catch {}
Write-Info "[build] success=$buildOk  distSize=$([math]::Round($distSize/1KB,1)) KB"

# ---------------- Phase 4: validation report --------------------------------
Write-Section "Phase 4: Generating validation_report.md"

# parse test counts
$testFailed = 0; $testPassed = 0; $testTotal = 0
if ($testsLine) {
  $m = [regex]::Match($testsLine,'(\d+)\s+failed');  if ($m.Success) { $testFailed = [int]$m.Groups[1].Value }
  $m = [regex]::Match($testsLine,'(\d+)\s+passed');  if ($m.Success) { $testPassed = [int]$m.Groups[1].Value }
  $m = [regex]::Match($testsLine,'(\d+)\s+total');   if ($m.Success) { $testTotal  = [int]$m.Groups[1].Value }
}

$overallPass = $testsPassed -and $buildOk -and ($auditResult.KilledBy -eq '') -and ($buildResult.KilledBy -eq '')

$report = @()
$report += "# Validation Report - AI CyberSecurity Platform"
$report += ""
$report += "**Generated:** $(([DateTime]::UtcNow).ToString('o'))"
$report += "**Pipeline started:** $([DateTime]$Global:StartTime)"
$report += "**Script:** run_backend_tests.ps1"
$report += ""
$report += "## Environment"
$report += "| Item | Value |"
$report += "|---|---|"
$report += "| Node | $( (node --version 2>$null) ) |"
$report += "| npm | $( (npm --version 2>$null) ) |"
$report += "| Platform | $env:OS (PowerShell 5.1) |"
$report += "| Working dir | $Script:Root |"
$report += ""
$report += "## Test Infrastructure"
$report += "| Service | Status |"
$report += "|---|---|"
$report += "| MongoDB (127.0.0.1:$MongoPort) | reachable=$mongoReachable (container cs-mongo) |"
$report += "| Redis (127.0.0.1:$RedisPort) | containerRunning=$rdsOk (container cs-redis) |"
$report += ""
$report += "## 1. Backend Test Results (Jest)"
$report += ""
$report += "| Field | Value |"
$report += "|---|---|"
$report += "| Test command | $NodeExe --require $UnbufShim $JestRunner --config $JestConfig --runInBand --verbose --detectOpenHandles --forceExit --coverage |"
$report += "| Planned test files | $($plannedTests.Count) |"
$report += "| Elapsed (s) | $($testResult.Elapsed) |"
$report += "| Jest exit code | $($testResult.ExitCode) |"
$report += "| Terminated by | $(if ($testResult.KilledBy -eq '') {'completed normally'} else {$testResult.KilledBy}) |"
$report += "| Outcome | $(if ($testsPassed) {'PASSED'} elseif ($testResult.KilledBy) {'TERMINATED (' + $testResult.KilledBy + ')'} else {'FAILED'}) |"
$report += "| Tests (pass/fail/total) | $testPassed / $testFailed / $testTotal |"
$report += ""
$report += "- **Tests line:** $testsLine"
$report += "- **Suites line:** $suitesLine"
$report += "- **Time line:** $timeLine"
$report += "- **Full Jest log:** $LogFile"
$report += "- **Machine result JSON:** $ResultJson"
$report += ""
if ($testResult.KilledBy) {
  $report += "### Hang / Termination Analysis (root cause)"
  $report += "- **Termination reason:** $($testResult.KilledBy)"
  $report += "- **Most likely hanging test suite/file:** $($hangInfo.HangingFile)"
  if ($hangInfo.LastCompleted) { $report += "- **Last completed suite:** $($hangInfo.LastCompleted.Raw)" } else { $report += "- **Last completed suite:** <none> (no file finished before termination)" }
  $report += "- **Completed suites so far:** $(if ($hangInfo.CompletedFiles.Count -gt 0) { $hangInfo.CompletedFiles.Count } else { 0 })"
  if ($hangInfo.CompletedFiles.Count -gt 0) {
    $report += ""
    $report += "| # | Result | Suite |"
    $report += "|---|---|---|"
    $i = 1
    foreach ($c in $hangInfo.CompletedFiles) { $report += "| $i | $($c.Result) | $($c.Raw) |"; $i++ }
  }
  if ($hangInfo.OpenHandles.Count -gt 0) {
    $report += ""
    $report += "#### Open handles reported by --detectOpenHandles:"
    foreach ($h in $hangInfo.OpenHandles) { $report += "- $( $h.Trim() -replace '\r','')" }
  }
  $report += ""
  $report += "#### Last 30 log lines at termination:"
  foreach ($l in $hangInfo.LogTail) { $report += ("    " + ($l.Trim() -replace '\r','')) }
}
$report += ""
$report += "## 2. npm audit (omit=dev)"
$report += ""
$report += "| Field | Value |"
$report += "|---|---|"
$report += "| exit code | $($auditResult.ExitCode) |"
$report += "| elapsed (s) | $($auditResult.Elapsed) |"
$report += "| terminated by | $(if ($auditResult.KilledBy) {'TERMINATED: ' + $auditResult.KilledBy} else {'completed normally'}) |"
$report += "| summary | $auditSummary |"
$report += ""
$report += "- **Full audit output:** $AuditFile"
$report += ""
$report += "## 3. Frontend build (npm run build)"
$report += ""
$report += "| Field | Value |"
$report += "|---|---|"
$report += "| exit code | $($buildResult.ExitCode) |"
$report += "| elapsed (s) | $($buildResult.Elapsed) |"
$report += "| status | $(if ($buildOk) {'SUCCESS'} else {'FAILED/TERMINATED'}) |"
$report += "| dist size | $([math]::Round($distSize/1KB,1)) KB |"
$report += ""
$report += "- **Full build output:** $BuildFile"
$report += ""
if (-not $buildOk) {
  $report += "#### Build log (tail):"
  foreach ($l in ($buildText | Select-Object -Last 25)) { $report += ("    " + ($l.Trim() -replace '\r','')) }
  $report += ""
}
$report += "## Overall Verdict"
$report += ""
if ($overallPass) {
  $report += "[PASS] - Backend tests passed, npm audit completed, and the frontend build succeeded within the 5-minute (300s) test budget."
} else {
  $report += "[ISSUE] - See the sections above for details."
  if (-not $testsPassed) {
    if ($testResult.KilledBy -eq 'HANG') { $report += "- Backend tests HUNG and were terminated; the hanging suite is identified above (root cause reported)." }
    elseif ($testResult.KilledBy -eq 'CAP') { $report += "- Backend tests did NOT complete within the 5-minute (300s) cap and were terminated." }
    else { $report += "- Backend tests FAILED (jest exit $($testResult.ExitCode))." }
  }
  if (-not $buildOk) { $report += "- Frontend build FAILED or was terminated (exit $($buildResult.ExitCode))." }
}
$report += ""
$report += "## Artifacts"
$report += "- run_backend_tests.ps1 (validation pipeline script)"
$report += "- $LogFile (full backend test output)"
$report += "- validation_report.md (this file)"
$report += "- $AuditFile (npm audit output)"
$report += "- $BuildFile (frontend build output)"
$report += "- backend/_unbuffered.cjs (unbuffered stdout shim)"
$report += "- backend/coverage/ (Jest coverage report)"

Set-Content -Path $ReportFile -Value ($report -join "`n") -Encoding UTF8
Write-Info "[report] written to $ReportFile"

# ---------------- final summary ---------------------------------------------
Write-Section "Pipeline complete"
if ($overallPass) { Write-Host "[FINAL] OVERALL PASSED" -ForegroundColor Green }
else            { Write-Host "[FINAL] OVERALL HAS ISSUES (see validation_report.md)" -ForegroundColor Yellow }
Write-Info "Report: $ReportFile"
exit $(if ($overallPass) { 0 } else { 1 })
