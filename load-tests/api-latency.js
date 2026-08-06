/**
 * Baseline API Latency Benchmark
 * Measures p50/p95/p99 for key endpoints.
 * Usage: node load-tests/api-latency.js
 */
import http from 'http';

const BASE = process.env.API_URL || 'http://localhost:5000';
const DURATION = 30; // seconds per endpoint

const endpoints = [
  { path: '/api/health', method: 'GET', body: null },
  { path: '/api/auth/register', method: 'POST', body: JSON.stringify({ name: 'Perf Test', email: `perf${Date.now()}@test.com`, password: 'Test123456!' }) },
  { path: '/api/scan/url', method: 'POST', body: JSON.stringify({ url: 'https://example.com' }) },
  { path: '/api/chat', method: 'POST', body: JSON.stringify({ message: 'What is phishing?' }) },
];

function makeRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint.path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port || 5000,
      path: url.pathname + url.search,
      method: endpoint.method,
      headers: { 'Content-Type': 'application/json' },
    };

    const start = Date.now();
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          latency: Date.now() - start,
          size: Buffer.byteLength(data),
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (endpoint.body) req.write(endpoint.body);
    req.end();
  });
}

async function runBenchmark() {
  console.log(`\n=== API Latency Benchmark ===`);
  console.log(`Target: ${BASE}\n`);

  for (const endpoint of endpoints) {
    const latencies = [];
    const startTime = Date.now();
    let count = 0;
    let errors = 0;

    console.log(`Testing ${endpoint.method} ${endpoint.path}...`);

    while (Date.now() - startTime < DURATION * 1000) {
      try {
        const result = await makeRequest(endpoint);
        latencies.push(result.latency);
        count++;
        if (result.status >= 400) errors++;
      } catch (err) {
        errors++;
      }
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    console.log(`  Requests: ${count} (errors: ${errors})`);
    console.log(`  Avg: ${avg.toFixed(1)}ms | p50: ${p50}ms | p95: ${p95}ms | p99: ${p99}ms\n`);
  }
}

runBenchmark().catch(console.error);
