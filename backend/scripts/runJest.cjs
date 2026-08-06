const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const scriptDir = path.dirname(process.argv[1] || __filename);
const backendDir = path.resolve(scriptDir, '..');
const rootDir = path.resolve(backendDir, '..');

const candidates = [
  path.join(backendDir, 'node_modules/jest/bin/jest.js'),
  path.join(rootDir, 'node_modules/jest/bin/jest.js'),
];

const jestBin = candidates.find((p) => fs.existsSync(p));

if (!jestBin) {
  console.error('Could not find jest binary. Looked in:');
  candidates.forEach((p) => console.error('  ' + p));
  process.exit(1);
}

const args = process.argv.slice(2);
const result = spawnSync('node', ['--experimental-vm-modules', jestBin, ...args], {
  stdio: 'inherit',
  cwd: backendDir,
});

process.exit(result.status ?? 0);
