/**
 * Redis Cache Efficiency Analyzer
 * Scans cache-related code for TTL, key design, and serialization patterns.
 * Usage: node load-tests/analyze-cache.js
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = join(process.cwd(), 'backend', 'src', 'services', 'cache');

const findings = [];

function scanFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Check for missing TTL on set
    if (/\.set\(/.test(line) && !/ttl/.test(line) && !/EX/.test(line)) {
      findings.push({
        file: filePath.replace(process.cwd() + '\\', ''),
        line: idx + 1,
        type: 'MISSING_TTL',
        snippet: line.trim(),
      });
    }

    // Check for JSON.stringify on large objects
    if (/JSON\.stringify/.test(line)) {
      findings.push({
        file: filePath.replace(process.cwd() + '\\', ''),
        line: idx + 1,
        type: 'SERIALIZATION_OVERHEAD',
        snippet: line.trim(),
      });
    }

    // Check for cache key without namespace
    if (/key\s*[=:]\s*['"`]/.test(line) || /cache.*key/.test(line)) {
      findings.push({
        file: filePath.replace(process.cwd() + '\\', ''),
        line: idx + 1,
        type: 'KEY_NAMING',
        snippet: line.trim(),
      });
    }
  });
}

try {
  for (const entry of readdirSync(CACHE_DIR)) {
    if (entry.endsWith('.js')) {
      scanFile(join(CACHE_DIR, entry));
    }
  }
} catch (e) {
  console.error('Error scanning cache dir:', e.message);
}

console.log(`\n=== Redis Cache Analysis ===`);
console.log(`Scanned: ${CACHE_DIR}`);
console.log(`Found ${findings.length} potential issues:\n`);

const grouped = {};
for (const f of findings) {
  if (!grouped[f.type]) grouped[f.type] = [];
  grouped[f.type].push(f);
}

for (const [type, items] of Object.entries(grouped)) {
  console.log(`[${type}] (${items.length} occurrences)`);
  for (const item of items.slice(0, 10)) {
    console.log(`  ${item.file}:${item.line} — ${item.snippet}`);
  }
  console.log('');
}
