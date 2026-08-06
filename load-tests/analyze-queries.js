/**
 * MongoDB Query Analyzer
 * Scans backend source files for potential query inefficiencies.
 * Usage: node load-tests/analyze-queries.js
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SRC_DIR = join(process.cwd(), 'backend', 'src');
const CONTROLLERS_DIR = join(SRC_DIR, 'controllers');
const SERVICES_DIR = join(SRC_DIR, 'services');

const findings = [];

function scanFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Check for find without limit/pagination
    if (/\.find\(/.test(line) && !/\.lean\(\)/.test(line) && !/\.limit\(/.test(line)) {
      const context = lines.slice(Math.max(0, idx - 2), idx + 3).join('\n');
      findings.push({
        file: filePath.replace(process.cwd() + '\\', ''),
        line: idx + 1,
        type: 'UNBOUNDED_QUERY',
        snippet: line.trim(),
        context,
      });
    }

    // Check for populate without projection
    if (/\.populate\(/.test(line) && !/select\(/.test(line)) {
      findings.push({
        file: filePath.replace(process.cwd() + '\\', ''),
        line: idx + 1,
        type: 'OVER_POPULATION',
        snippet: line.trim(),
      });
    }

    // Check for aggregation without index hint
    if (/\.aggregate\(/.test(line)) {
      const nextLines = lines.slice(idx, Math.min(lines.length, idx + 5)).join('\n');
      if (!/\$match/.test(nextLines)) {
        findings.push({
          file: filePath.replace(process.cwd() + '\\', ''),
          line: idx + 1,
          type: 'AGGREGATION_NO_MATCH',
          snippet: line.trim(),
        });
      }
    }

    // Check for nested filter on arrays (O(n*m))
    if (/\.filter\(/.test(line) && /for\s*\(/.test(lines[idx - 1] || '')) {
      findings.push({
        file: filePath.replace(process.cwd() + '\\', ''),
        line: idx + 1,
        type: 'NESTED_FILTER',
        snippet: line.trim(),
        context: lines.slice(Math.max(0, idx - 3), idx + 2).join('\n'),
      });
    }
  });
}

function scanDir(dir) {
  try {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = readFileSync(fullPath) ? null : null;
      // Simple check: if it's a directory, recurse; if .js file, scan
      if (entry.endsWith('.js')) {
        scanFile(fullPath);
      }
    }
  } catch (e) {
    // Ignore permission errors
  }
}

scanDir(CONTROLLERS_DIR);
scanDir(SERVICES_DIR);

console.log(`\n=== MongoDB Query Analysis ===`);
console.log(`Found ${findings.length} potential issues:\n`);

const grouped = {};
for (const f of findings) {
  if (!grouped[f.type]) grouped[f.type] = [];
  grouped[f.type].push(f);
}

for (const [type, items] of Object.entries(grouped)) {
  console.log(`[${type}] (${items.length} occurrences)`);
  for (const item of items.slice(0, 5)) {
    console.log(`  ${item.file}:${item.line}`);
    console.log(`    ${item.snippet}`);
    if (item.context) {
      console.log(`    Context:\n      ${item.context.split('\n').join('\n      ')}`);
    }
  }
  if (items.length > 5) console.log(`  ... and ${items.length - 5} more`);
  console.log('');
}
