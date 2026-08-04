import logger from '../../utils/logger.js';

class MetricsService {
  constructor() {
    this.metrics = {
      httpRequests: { total: 0, byMethod: {}, byRoute: {}, byStatus: {} },
      responseTime: { sum: 0, count: 0, min: Infinity, max: 0, buckets: [] },
      apiLatency: { sum: 0, count: 0, byEndpoint: {} },
      cpu: { usage: 0, cores: 0, loadAverage: [0, 0, 0] },
      memory: { heapUsed: 0, heapTotal: 0, rss: 0, external: 0 },
      disk: { total: 0, free: 0, used: 0, usagePercent: 0 },
      mongo: { connections: 0, operations: 0, queryTime: 0, errors: 0 },
      socket: { connections: 0, messagesSent: 0, messagesReceived: 0, rooms: 0 },
      ai: { requests: 0, errors: 0, latency: 0, tokensUsed: 0, cacheHits: 0 },
      threatIntel: { queries: 0, cacheHits: 0, errors: 0, providersActive: 0 },
      knowledgeGraph: { entities: 0, relationships: 0, queries: 0, indexSize: 0 },
      ueba: { profilesAnalyzed: 0, anomaliesDetected: 0, riskScoresComputed: 0 },
      cloud: { scans: 0, findings: 0, providersActive: 0, resourcesScanned: 0 },
      container: { imagesScanned: 0, vulnerabilitiesFound: 0, secretsFound: 0, runtimeChecks: 0 },
      kubernetes: { clusters: 0, resourcesScanned: 0, highRiskResources: 0, podsScanned: 0 },
      system: { uptime: 0, processCount: 0, eventLoopDelay: 0, activeHandles: 0 },
      alerts: { total: 0, bySeverity: {}, byType: {}, active: 0, resolved: 0 },
      errors: { total: 0, byCode: {}, byService: {} },
      performance: { p50: 0, p95: 0, p99: 0, avg: 0 },
    };
    this._startTime = Date.now();
    this._intervalId = null;
  }

  startCollection(intervalMs = 15000) {
    this._intervalId = setInterval(() => {
      this._collectSystemMetrics();
      this._collectProcessMetrics();
    }, intervalMs);
    this._collectSystemMetrics();
    this._collectProcessMetrics();
    logger.info('[metricsService] Started metrics collection', { intervalMs });
  }

  stopCollection() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    logger.info('[metricsService] Stopped metrics collection');
  }

  _collectSystemMetrics() {
    try {
      const memUsage = process.memoryUsage();
      this.metrics.memory = {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external || 0,
      };
      this.metrics.system.uptime = Math.floor((Date.now() - this._startTime) / 1000);
      this.metrics.system.activeHandles = process._getActiveHandles ? process._getActiveHandles().length : 0;
    } catch (err) {
      logger.warn('[metricsService] System metrics collection error', { error: err.message });
    }
  }

  _collectProcessMetrics() {
    try {
      const cpuUsage = process.cpuUsage();
      this.metrics.cpu = {
        usage: cpuUsage.user + cpuUsage.system,
        cores: require('os').cpus().length,
        loadAverage: require('os').loadavg(),
      };
      const totalMem = require('os').totalmem();
      const freeMem = require('os').freemem();
      this.metrics.disk = {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      };
    } catch (err) {
      logger.warn('[metricsService] Process metrics collection error', { error: err.message });
    }
  }

  recordHttpRequest(method, route, statusCode, responseTimeMs) {
    this.metrics.httpRequests.total++;
    this.metrics.httpRequests.byMethod[method] = (this.metrics.httpRequests.byMethod[method] || 0) + 1;
    this.metrics.httpRequests.byRoute[route] = (this.metrics.httpRequests.byRoute[route] || 0) + 1;
    this.metrics.httpRequests.byStatus[statusCode] = (this.metrics.httpRequests.byStatus[statusCode] || 0) + 1;

    this.metrics.responseTime.sum += responseTimeMs;
    this.metrics.responseTime.count++;
    this.metrics.responseTime.min = Math.min(this.metrics.responseTime.min, responseTimeMs);
    this.metrics.responseTime.max = Math.max(this.metrics.responseTime.max, responseTimeMs);
    this.metrics.responseTime.buckets.push(responseTimeMs);
    if (this.metrics.responseTime.buckets.length > 1000) {
      this.metrics.responseTime.buckets.shift();
    }

    if (responseTimeMs > 1000) {
      this.metrics.errors.total++;
      this.metrics.errors.byCode[statusCode] = (this.metrics.errors.byCode[statusCode] || 0) + 1;
    }

    this._updatePerformancePercentiles();
  }

  recordApiLatency(endpoint, latencyMs) {
    this.metrics.apiLatency.sum += latencyMs;
    this.metrics.apiLatency.count++;
    this.metrics.apiLatency.byEndpoint[endpoint] = (this.metrics.apiLatency.byEndpoint[endpoint] || 0) + latencyMs;
  }

  recordSocketConnection() {
    this.metrics.socket.connections++;
  }

  recordSocketDisconnection() {
    this.metrics.socket.connections = Math.max(0, this.metrics.socket.connections - 1);
  }

  recordSocketMessage(direction) {
    if (direction === 'sent') this.metrics.socket.messagesSent++;
    else this.metrics.socket.messagesReceived++;
  }

  recordMongoOperation(queryTimeMs) {
    this.metrics.mongo.operations++;
    this.metrics.mongo.queryTime += queryTimeMs;
  }

  recordMongoError() {
    this.metrics.mongo.errors++;
  }

  recordAIRequest(latencyMs, tokensUsed) {
    this.metrics.ai.requests++;
    this.metrics.ai.latency += latencyMs;
    this.metrics.ai.tokensUsed += tokensUsed;
  }

  recordAIError() {
    this.metrics.ai.errors++;
  }

  recordAICacheHit() {
    this.metrics.ai.cacheHits++;
  }

  recordThreatIntelQuery(cacheHit) {
    this.metrics.threatIntel.queries++;
    if (cacheHit) this.metrics.threatIntel.cacheHits++;
  }

  recordCloudScan(findingsCount) {
    this.metrics.cloud.scans++;
    this.metrics.cloud.findings += findingsCount;
  }

  recordContainerScan(vulnerabilities, secrets) {
    this.metrics.container.imagesScanned++;
    this.metrics.container.vulnerabilitiesFound += vulnerabilities;
    this.metrics.container.secretsFound += secrets;
  }

  recordKubernetesResource(highRisk) {
    this.metrics.kubernetes.resourcesScanned++;
    if (highRisk) this.metrics.kubernetes.highRiskResources++;
  }

  recordAlert(severity, type) {
    this.metrics.alerts.total++;
    this.metrics.alerts.bySeverity[severity] = (this.metrics.alerts.bySeverity[severity] || 0) + 1;
    this.metrics.alerts.byType[type] = (this.metrics.alerts.byType[type] || 0) + 1;
    this.metrics.alerts.active++;
  }

  recordAlertResolved() {
    this.metrics.alerts.active = Math.max(0, this.metrics.alerts.active - 1);
    this.metrics.alerts.resolved++;
  }

  recordKnowledgeGraphEntity() {
    this.metrics.knowledgeGraph.entities++;
  }

  recordKnowledgeGraphRelationship() {
    this.metrics.knowledgeGraph.relationships++;
  }

  recordKnowledgeGraphQuery() {
    this.metrics.knowledgeGraph.queries++;
  }

  recordUEBAEvent() {
    this.metrics.ueba.profilesAnalyzed++;
  }

  recordUEBAAnomaly() {
    this.metrics.ueba.anomaliesDetected++;
  }

  recordUEBARiskScore() {
    this.metrics.ueba.riskScoresComputed++;
  }

  recordError(code, service) {
    this.metrics.errors.total++;
    this.metrics.errors.byCode[code] = (this.metrics.errors.byCode[code] || 0) + 1;
    this.metrics.errors.byService[service] = (this.metrics.errors.byService[service] || 0) + 1;
  }

  _updatePerformancePercentiles() {
    const buckets = this.metrics.responseTime.buckets;
    if (buckets.length === 0) return;
    const sorted = [...buckets].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const sum = sorted.reduce((a, b) => a + b, 0);
    this.metrics.performance = {
      p50,
      p95,
      p99,
      avg: Math.round(sum / sorted.length),
    };
  }

  getPrometheusMetrics() {
    const m = this.metrics;
    const uptime = Math.floor((Date.now() - this._startTime) / 1000);
    const lines = [];

    lines.push('# HELP http_requests_total Total HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    lines.push(`http_requests_total ${m.httpRequests.total}`);

    lines.push('# HELP http_requests_by_method HTTP requests by method');
    lines.push('# TYPE http_requests_by_method counter');
    for (const [method, count] of Object.entries(m.httpRequests.byMethod)) {
      lines.push(`http_requests_by_method{method="${method}"} ${count}`);
    }

    lines.push('# HELP http_requests_by_status HTTP requests by status code');
    lines.push('# TYPE http_requests_by_status counter');
    for (const [status, count] of Object.entries(m.httpRequests.byStatus)) {
      lines.push(`http_requests_by_status{status="${status}"} ${count}`);
    }

    lines.push('# HELP http_response_time_ms HTTP response time in milliseconds');
    lines.push('# TYPE http_response_time_ms summary');
    lines.push(`http_response_time_ms_sum ${m.responseTime.sum}`);
    lines.push(`http_response_time_ms_count ${m.responseTime.count}`);
    lines.push(`http_response_time_ms_min ${m.responseTime.min === Infinity ? 0 : m.responseTime.min}`);
    lines.push(`http_response_time_ms_max ${m.responseTime.max}`);

    lines.push('# HELP api_latency_ms API latency in milliseconds');
    lines.push('# TYPE api_latency_ms summary');
    lines.push(`api_latency_ms_sum ${m.apiLatency.sum}`);
    lines.push(`api_latency_ms_count ${m.apiLatency.count}`);

    lines.push('# HELP cpu_usage_percent CPU usage percentage');
    lines.push('# TYPE cpu_usage_percent gauge');
    lines.push(`cpu_usage_percent ${m.cpu.usage}`);
    lines.push(`cpu_cores ${m.cpu.cores}`);
    lines.push(`cpu_load_average_1m ${m.cpu.loadAverage[0]}`);
    lines.push(`cpu_load_average_5m ${m.cpu.loadAverage[1]}`);
    lines.push(`cpu_load_average_15m ${m.cpu.loadAverage[2]}`);

    lines.push('# HELP memory_usage_bytes Memory usage in bytes');
    lines.push('# TYPE memory_usage_bytes gauge');
    lines.push(`memory_heap_used_bytes ${m.memory.heapUsed}`);
    lines.push(`memory_heap_total_bytes ${m.memory.heapTotal}`);
    lines.push(`memory_rss_bytes ${m.memory.rss}`);
    lines.push(`memory_external_bytes ${m.memory.external}`);

    lines.push('# HELP disk_usage_bytes Disk usage in bytes');
    lines.push('# TYPE disk_usage_bytes gauge');
    lines.push(`disk_total_bytes ${m.disk.total}`);
    lines.push(`disk_free_bytes ${m.disk.free}`);
    lines.push(`disk_used_bytes ${m.disk.used}`);
    lines.push(`disk_usage_percent ${m.disk.usagePercent}`);

    lines.push('# HELP mongo_operations_total Total MongoDB operations');
    lines.push('# TYPE mongo_operations_total counter');
    lines.push(`mongo_operations_total ${m.mongo.operations}`);
    lines.push(`mongo_errors_total ${m.mongo.errors}`);
    lines.push(`mongo_query_time_ms ${m.mongo.queryTime}`);

    lines.push('# HELP socket_connections Active Socket.IO connections');
    lines.push('# TYPE socket_connections gauge');
    lines.push(`socket_connections ${m.socket.connections}`);
    lines.push(`socket_messages_sent_total ${m.socket.messagesSent}`);
    lines.push(`socket_messages_received_total ${m.socket.messagesReceived}`);

    lines.push('# HELP ai_requests_total Total AI requests');
    lines.push('# TYPE ai_requests_total counter');
    lines.push(`ai_requests_total ${m.ai.requests}`);
    lines.push(`ai_errors_total ${m.ai.errors}`);
    lines.push(`ai_cache_hits_total ${m.ai.cacheHits}`);
    lines.push(`ai_tokens_used_total ${m.ai.tokensUsed}`);

    lines.push('# HELP threat_intel_queries_total Total threat intelligence queries');
    lines.push('# TYPE threat_intel_queries_total counter');
    lines.push(`threat_intel_queries_total ${m.threatIntel.queries}`);
    lines.push(`threat_intel_cache_hits_total ${m.threatIntel.cacheHits}`);

    lines.push('# HELP knowledge_graph_entities Total knowledge graph entities');
    lines.push('# TYPE knowledge_graph_entities gauge');
    lines.push(`knowledge_graph_entities ${m.knowledgeGraph.entities}`);
    lines.push(`knowledge_graph_relationships ${m.knowledgeGraph.relationships}`);
    lines.push(`knowledge_graph_queries_total ${m.knowledgeGraph.queries}`);

    lines.push('# HELP ueba_profiles_analyzed_total Total UEBA profiles analyzed');
    lines.push('# TYPE ueba_profiles_analyzed_total counter');
    lines.push(`ueba_profiles_analyzed_total ${m.ueba.profilesAnalyzed}`);
    lines.push(`ueba_anomalies_detected_total ${m.ueba.anomaliesDetected}`);

    lines.push('# HELP cloud_scans_total Total cloud security scans');
    lines.push('# TYPE cloud_scans_total counter');
    lines.push(`cloud_scans_total ${m.cloud.scans}`);
    lines.push(`cloud_findings_total ${m.cloud.findings}`);

    lines.push('# HELP container_scans_total Total container scans');
    lines.push('# TYPE container_scans_total counter');
    lines.push(`container_images_scanned_total ${m.container.imagesScanned}`);
    lines.push(`container_vulnerabilities_total ${m.container.vulnerabilitiesFound}`);
    lines.push(`container_secrets_total ${m.container.secretsFound}`);

    lines.push('# HELP kubernetes_resources_scanned_total Total k8s resources scanned');
    lines.push('# TYPE kubernetes_resources_scanned_total counter');
    lines.push(`kubernetes_resources_scanned_total ${m.kubernetes.resourcesScanned}`);
    lines.push(`kubernetes_high_risk_resources ${m.kubernetes.highRiskResources}`);

    lines.push('# HELP alerts_total Total alerts');
    lines.push('# TYPE alerts_total counter');
    lines.push(`alerts_total ${m.alerts.total}`);
    lines.push(`alerts_active ${m.alerts.active}`);
    lines.push(`alerts_resolved_total ${m.alerts.resolved}`);

    lines.push('# HELP system_uptime_seconds System uptime in seconds');
    lines.push('# TYPE system_uptime_seconds counter');
    lines.push(`system_uptime_seconds ${uptime}`);

    lines.push('# HELP error_total Total errors');
    lines.push('# TYPE error_total counter');
    lines.push(`error_total ${m.errors.total}`);

    lines.push('# HELP performance_percentile Performance percentiles in milliseconds');
    lines.push('# TYPE performance_percentile gauge');
    lines.push(`performance_p50_ms ${m.performance.p50}`);
    lines.push(`performance_p95_ms ${m.performance.p95}`);
    lines.push(`performance_p99_ms ${m.performance.p99}`);
    lines.push(`performance_avg_ms ${m.performance.avg}`);

    return lines.join('\n') + '\n';
  }

  getMetricsSnapshot() {
    return {
      ...this.metrics,
      uptime: Math.floor((Date.now() - this._startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}

const metricsService = new MetricsService();
export default metricsService;