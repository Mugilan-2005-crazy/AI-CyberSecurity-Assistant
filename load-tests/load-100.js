/**
 * Load Test: 100 Concurrent Users
 * Simulates realistic mixed workload for 60 seconds.
 * Usage: node load-tests/load-100.js
 */
import http from 'http';

const BASE = process.env.API_URL || 'http://localhost:5000';
const CONCURRENT_USERS = 100;
const DURATION = 60; // seconds

const scenarios = [
  { weight: 40, path: '/api/health', method: 'GET', body: null },
  { weight: 25, path: '/api/scan/url', method: 'POST', body: JSON.stringify({ url: 'https://example.com' }) },
  { weight: 15, path: '/api/chat', method: 'POST', body: JSON.stringify({ message: 'Explain phishing' }) },
  { weight: 10, path: '/api/scan/password', method: 'POST', body: JSON.stringify({ password: 'Test123!@#' }) },
  { weight: 10, path: '/api/admin/analytics', method: 'GET', body: null },
];

function weightedRandom() {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const s of scenarios) {
    cumulative += s.weight;
    if (rand <= cumulative) return s;
  }
  return scenarios[0];
}

function makeRequest(scenario) {
  return new Promise((resolve) => {
    const url = new URL(scenario.path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port || 5000,
      path: url.pathname + url.search,
      method: scenario.method,
      headers: { 'Content-Type': 'application/json' },
    };

    const start = Date.now();
    const req = http.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        resolve({ latency: Date.now() - start, status: res.statusCode });
      });
    });

    req.on('error', () => resolve({ latency: Date.now() - start, status: 0 }));
    if (scenario.body) req.write(scenario.body);
    req.end();
  });
}

async function runLoadTest() {
  console.log(`\n=== Load Test: ${CONCURRENT_USERS} users ===`);
  console.log(`Target: ${BASE} | Duration: ${DURATION}s\n`);

  const results = [];
  const startTime = Date.now();
  let totalRequests = 0;
  let errors = 0;

  async function userLoop() {
    while (Date.now() - startTime < DURATION * 1000) {
      const scenario = weightedRandom();
      const result = await makeRequest(scenario);
      results.push(result);
      totalRequests++;
      if (result.status === 0 || result.status >= 500) errors++;
      await new Promise(r => setTimeout(r, 100 + Math.random() * 400));
    }
  }

  await Promise.all(Array.from({ length: CONCURRENT_USERS }, () => userLoop()));

  results.sort((a, b) => a.latency - b.latency);
  const p50 = results[Math.floor(results.length * 0.5)]?.latency || 0;
  const p95 = results[Math.floor(results.length * 0.95)]?.latency || 0;
  const p99 = results[Math.floor(results.length * 0.99)]?.latency || 0;
  const avg = results.reduce((a, b) => a + b.latency, 0) / results.length;
  const rps = totalRequests / DURATION;

  console.log(`Total requests: ${totalRequests}`);
  console.log(`Errors: ${errors} (${((errors / totalRequests) * 100).toFixed(2)}%)`);
  console.log(`Throughput: ${rps.toFixed(1)} req/s`);
  console.log(`Avg: ${avg.toFixed(1)}ms | p50: ${p50}ms | p95: ${p95}ms | p99: ${p99}ms`);
}

runLoadTest().catch(console.error);
