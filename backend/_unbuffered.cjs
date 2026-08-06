// _unbuffered.cjs - force synchronous (line-buffered) writes to piped stdout/stderr.
// Safe no-op when streams are TTY or unavailable.
try {
  var out = process.stdout, err = process.stderr;
  if (out && out._handle && typeof out._handle.setBlocking === 'function') out._handle.setBlocking(true);
  if (err && err._handle && typeof err._handle.setBlocking === 'function') err._handle.setBlocking(true);
} catch (e) {}
