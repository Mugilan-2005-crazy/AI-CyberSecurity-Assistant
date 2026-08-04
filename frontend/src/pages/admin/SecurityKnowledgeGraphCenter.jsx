/**
 * pages/admin/SecurityKnowledgeGraphCenter.jsx
 * ------------------------------------------------------------
 * PHASE 6 — Security Knowledge Graph Center.
 * Reuses: endpoints, useSocket, existing UI components.
 *
 * Features:
 *  - Interactive graph visualization
 *  - Entity search
 *  - Filter by type/threat level
 *  - Attack path discovery
 *  - AI-generated graph insights
 *  - Realtime graph updates via Socket.IO
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { useSocket } from '../../hooks/useSocket.js';
import endpoints from '../../services/endpoints.js';
import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Loader from '../../components/ui/Loader.jsx';
import StateView from '../../components/ui/StateView.jsx';
import ForceGraph2D from 'react-force-graph-2d';

const NODE_COLORS = {
  User: '#6366f1',
  IP: '#ef4444',
  Domain: '#f59e0b',
  URL: '#3b82f6',
  Hash: '#8b5cf6',
  Malware: '#dc2626',
  ThreatActor: '#b91c1c',
  CVE: '#ea580c',
  MITRETechnique: '#059669',
  SecurityAlert: '#db2777',
  SecurityIncident: '#dc2626',
  IncidentReport: '#7c3aed',
  CloudAsset: '#0891b2',
  Vulnerability: '#d97706',
};

const THREAT_LEVEL_COLORS = {
  Low: '#10b981',
  Medium: '#f59e0b',
  High: '#f97316',
  Critical: '#ef4444',
};

export default function SecurityKnowledgeGraphCenter() {
  const { t } = useTranslation();
  const { connected, on } = useSocket(true);
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterThreatLevel, setFilterThreatLevel] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [attackPathSource, setAttackPathSource] = useState('');
  const [attackPathTarget, setAttackPathTarget] = useState('');
  const [attackPaths, setAttackPaths] = useState([]);
  const [pathLoading, setPathLoading] = useState(false);
  const graphRef = useRef();

  const loadGraph = useCallback(() => {
    setLoading(true);
    return endpoints
      .getKnowledgeGraph({ entityType: filterType || undefined, threatLevel: filterThreatLevel || undefined })
      .then((data) => setGraph(data))
      .catch(() => toast.error('Failed to load graph'))
      .finally(() => setLoading(false));
  }, [filterType, filterThreatLevel]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    const unsubCreated = on('graph.entity.created', (payload) => {
      toast.info(`New entity: ${payload.label}`);
      loadGraph();
    });
    const unsubRelationship = on('graph.relationship.created', (payload) => {
      toast.info('New relationship created');
      loadGraph();
    });
    const unsubRisk = on('graph.risk.updated', (payload) => {
      toast.info('Graph risk updated');
      loadGraph();
    });

    return () => {
      unsubCreated?.();
      unsubRelationship?.();
      unsubRisk?.();
    };
  }, [on, loadGraph]);

  const handleBuildGraph = async () => {
    setBuilding(true);
    try {
      const result = await endpoints.buildKnowledgeGraph();
      toast.success(`Graph built: ${result.data?.entityCount || 0} entities`);
      loadGraph();
    } catch {
      toast.error('Failed to build graph');
    } finally {
      setBuilding(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const results = await endpoints.searchKnowledgeGraph(searchQuery.trim());
      setGraph({
        nodes: results.entities.map((e) => ({
          id: e.entityId,
          label: e.label,
          type: e.entityType,
          riskScore: e.riskScore,
          threatLevel: e.threatLevel,
          properties: e.properties,
        })),
        edges: results.relationships.map((r) => ({
          id: `${r.sourceEntityId}-${r.targetEntityId}-${r.relationshipType}`,
          source: r.sourceEntityId,
          target: r.targetEntityId,
          type: r.relationshipType,
          weight: r.weight,
        })),
      });
    } catch {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleInsights = async () => {
    setInsightsLoading(true);
    try {
      const result = await endpoints.getGraphInsights();
      setInsights(result.data);
    } catch {
      toast.error('Failed to load insights');
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleFindPaths = async () => {
    if (!attackPathSource || !attackPathTarget) {
      toast.error('Enter both source and target entity IDs');
      return;
    }
    setPathLoading(true);
    try {
      const result = await endpoints.getAttackPaths(attackPathSource, attackPathTarget);
      setAttackPaths(result.data.paths || []);
      if (!result.data.paths?.length) {
        toast.info('No attack paths found');
      }
    } catch {
      toast.error('Path search failed');
    } finally {
      setPathLoading(false);
    }
  };

  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };

  const handleCloseDetails = () => {
    setSelectedNode(null);
  };

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const label = node.label || node.id;
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    const textWidth = ctx.measureText(label).width;
    const bkgWidth = textWidth + 8;
    const bkgHeight = fontSize + 4;

    ctx.fillStyle = NODE_COLORS[node.type] || '#6366f1';
    ctx.beginPath();
    ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
    ctx.fill();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.beginPath();
    ctx.roundRect(node.x - bkgWidth / 2, node.y + 10, bkgWidth, bkgHeight, 4);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, node.x, node.y + 10 + bkgHeight / 2);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Security Knowledge Graph</h1>
          <p className="text-sm text-slate-400">Discover hidden attack patterns and entity relationships</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${connected ? 'bg-green-500/15 text-green-400' : 'bg-slate-500/15 text-slate-400'}`}>
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-400' : 'bg-slate-400'}`} />
            {connected ? 'Live' : 'Offline'}
          </span>
          <Button variant="cyber" size="sm" onClick={handleBuildGraph} loading={building}>
            Build Graph
          </Button>
          <Button variant="outline" size="sm" onClick={loadGraph}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <Card title="Filters" description="Filter graph entities">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search entities..."
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-surface-card px-3 py-2 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button variant="outline" size="sm" onClick={handleSearch} className="w-full mt-2">
                  Search
                </Button>
              </div>
              <div>
                <label className="text-xs text-slate-400">Entity Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-surface-card px-3 py-2 text-sm"
                >
                  <option value="">All Types</option>
                  <option value="IP">IP Address</option>
                  <option value="Domain">Domain</option>
                  <option value="URL">URL</option>
                  <option value="Hash">File Hash</option>
                  <option value="CVE">CVE</option>
                  <option value="MITRETechnique">MITRE Technique</option>
                  <option value="SecurityAlert">Security Alert</option>
                  <option value="SecurityIncident">Security Incident</option>
                  <option value="ThreatIntel">Threat Intel</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Threat Level</label>
                <select
                  value={filterThreatLevel}
                  onChange={(e) => setFilterThreatLevel(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-surface-card px-3 py-2 text-sm"
                >
                  <option value="">All Levels</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <Button variant="outline" size="sm" onClick={handleInsights} loading={insightsLoading} className="w-full">
                AI Insights
              </Button>
            </div>
          </Card>

          <Card title="Attack Path" description="Find attack paths between entities">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Source Entity ID</label>
                <input
                  type="text"
                  value={attackPathSource}
                  onChange={(e) => setAttackPathSource(e.target.value)}
                  placeholder="Source entity ID"
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-surface-card px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Target Entity ID</label>
                <input
                  type="text"
                  value={attackPathTarget}
                  onChange={(e) => setAttackPathTarget(e.target.value)}
                  placeholder="Target entity ID"
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-surface-card px-3 py-2 text-sm"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleFindPaths} loading={pathLoading} className="w-full">
                Find Paths
              </Button>
              {attackPaths.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {attackPaths.map((path, i) => (
                    <div key={i} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs">
                      <p className="font-medium mb-1">Path {i + 1} (length: {path.length})</p>
                      {path.map((step, j) => (
                        <p key={j} className="text-slate-400">
                          {j > 0 && '→ '}{step.relationshipType} {step.entityId?.slice(0, 8)}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {insights && (
            <Card title="AI Insights" description="Graph analysis">
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Provider: {insights.provider}</p>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{insights.insights}</p>
                {insights.summary && (
                  <div className="text-xs text-slate-400 space-y-1">
                    <p>Nodes: {insights.summary.totalNodes}</p>
                    <p>Edges: {insights.summary.totalEdges}</p>
                    <p>High Risk: {insights.summary.highRiskCount}</p>
                    <p>Critical: {insights.summary.criticalCount}</p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="lg:col-span-3">
          {loading ? (
            <Card>
              <Loader />
            </Card>
          ) : !graph.nodes.length ? (
            <Card>
              <StateView type="empty" title="No graph data" message="Build graph from your security data to visualize relationships." />
            </Card>
          ) : (
            <Card title="Knowledge Graph" description="Interactive security entity graph">
              <div className="h-[600px] w-full rounded-xl overflow-hidden bg-slate-900/50">
                <ForceGraph2D
                  ref={graphRef}
                  graphData={graph}
                  nodeCanvasObject={nodeCanvasObject}
                  nodeCanvasObjectMode={() => 'after'}
                  linkDirectionalArrowLength={3}
                  linkDirectionalArrowRelPos={1}
                  linkWidth={(link) => (link.weight || 1) / 20}
                  linkColor={() => 'rgba(148, 163, 184, 0.4)'}
                  onNodeClick={handleNodeClick}
                  cooldownTicks={100}
                  enableZoomInteraction
                  enablePanInteraction
                />
              </div>
            </Card>
          )}

          {selectedNode && (
            <Card title={`${selectedNode.type}: ${selectedNode.label}`} description={`Risk Score: ${selectedNode.riskScore}`} className="mt-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge tone={selectedNode.threatLevel === 'Critical' ? 'danger' : selectedNode.threatLevel === 'High' ? 'warning' : 'info'}>
                    {selectedNode.threatLevel}
                  </Badge>
                  <span className="text-xs text-slate-400">ID: {selectedNode.id?.slice(0, 12)}...</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Type</p>
                    <p className="font-medium">{selectedNode.type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Risk Score</p>
                    <p className="font-medium">{selectedNode.riskScore}/100</p>
                  </div>
                </div>
                {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Properties</p>
                    <pre className="text-xs bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl overflow-x-auto">
                      {JSON.stringify(selectedNode.properties, null, 2)}
                    </pre>
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={handleCloseDetails}>
                  Close
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
