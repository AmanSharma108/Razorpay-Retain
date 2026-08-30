import React, { useState, useEffect } from 'react';
import { 
  Search, ChevronDown, ChevronRight, FileJson, 
  RefreshCw, Cpu, ShieldAlert, CheckCircle2
} from 'lucide-react';
import { auditAPI } from '../api/client';
import EventDrawer from '../components/EventDrawer';
import { toast } from 'sonner';

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [searchEventId, setSearchEventId] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const stages = [
    { key: 'all', label: 'All Stages' },
    { key: 'action_selected', label: 'Bandit Selection' },
    { key: 'human_review_required', label: 'Review Triggered' },
    { key: 'human_approved', label: 'Human Approved' },
    { key: 'human_rejected', label: 'Human Rejected' },
    { key: 'auto_approved', label: 'Auto Approved' },
    { key: 'action_executed', label: 'Dispatched' },
    { key: 'verified', label: 'Verified' },
  ];

  useEffect(() => {
    fetchLogs();
  }, [searchEventId, stageFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { page_size: 50 };
      if (searchEventId && !isNaN(searchEventId)) {
        params.event_id = parseInt(searchEventId);
      }
      
      const res = await auditAPI.list(params);
      setLogs(res.data.items || []);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleCopyPayload = (e, id, details) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(details, null, 2));
    setCopiedId(id);
    toast.success('Copied JSON payload');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStageDotColor = (stage) => {
    switch (stage) {
      case 'action_selected':
        return 'bg-[var(--accent-brand)]';
      case 'human_approved':
        return 'bg-[var(--status-success)]';
      case 'human_rejected':
        return 'bg-[var(--status-error)]';
      case 'human_review_required':
        return 'bg-[var(--status-warning)]';
      case 'auto_approved':
        return 'bg-[var(--accent-brand)]';
      case 'action_executed':
        return 'bg-[var(--status-warning)]';
      case 'verified':
        return 'bg-[var(--status-success)]';
      default:
        return 'bg-[var(--ink-muted)]';
    }
  };

  const extractPlainRationale = (log) => {
    if (!log?.details) return null;
    const d = log.details;
    if (d.rationale) return d.rationale;
    if (d.review_reason) return `Human Review Decision: "${d.review_reason}"`;
    if (d.reason) return d.reason;
    if (d.triggers && Array.isArray(d.triggers)) return `Review Triggers: ${d.triggers.join('; ')}`;
    if (d.root_cause) return `Diagnosed root cause '${d.root_cause}' with strategy ${d.strategy_applied || ''}`;
    if (d.action_type) return `Dispatched recovery action '${d.action_type}'`;
    return null;
  };

  const filteredLogs = logs.filter(l => {
    if (stageFilter !== 'all' && l.stage !== stageFilter) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold text-[var(--ink-primary)] tracking-tight">
            Immutable Audit Trail & Decision Logs
          </h1>
          <p className="text-[var(--ink-muted)] text-xs mt-0.5">
            Cryptographically structured ledger of diagnosis, bandit selections, and operator actions.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative w-48">
            <Search className="w-3.5 h-3.5 text-[var(--ink-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="number"
              placeholder="Filter Incident ID..."
              value={searchEventId}
              onChange={(e) => setSearchEventId(e.target.value)}
              className="w-full bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--ink-primary)] text-xs rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:border-[var(--accent-brand)] font-mono placeholder-[var(--ink-tertiary)]"
            />
          </div>

          <button
            onClick={fetchLogs}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--ink-primary)] text-xs font-semibold shadow-sm transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stage Filter Tabs */}
      <div className="flex flex-wrap gap-1 p-2 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
        {stages.map((stg) => (
          <button
            key={stg.key}
            onClick={() => setStageFilter(stg.key)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              stageFilter === stg.key 
                ? 'bg-[var(--accent-brand-subtle)] text-[var(--accent-brand)] font-semibold border border-[var(--accent-brand)]/20' 
                : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            {stg.label}
          </button>
        ))}
      </div>

      {/* Audit Table */}
      <div className="rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] font-mono text-[var(--ink-muted)] bg-[var(--surface-card-subtle)] border-b border-[var(--border-subtle)] uppercase">
              <tr>
                <th className="px-4 py-2.5 w-8"></th>
                <th className="px-4 py-2.5 w-24">Timestamp</th>
                <th className="px-4 py-2.5 w-20">Incident</th>
                <th className="px-4 py-2.5 w-44">Pipeline Stage</th>
                <th className="px-4 py-2.5">Decision Rationale & Explainability</th>
                <th className="px-4 py-2.5 w-28 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-[var(--ink-muted)]">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-[var(--accent-brand)]" />
                    <span className="font-mono text-xs">Loading audit ledger...</span>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-10 text-center text-[var(--ink-muted)] font-mono">
                    No audit records matching criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  const rationaleText = extractPlainRationale(log);
                  const isActionSelected = log.stage === 'action_selected';

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => toggleExpand(log.id)}
                        className="hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-[var(--ink-tertiary)]">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td className="px-4 py-3 text-[var(--ink-muted)] font-mono tabular-nums whitespace-nowrap">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEventId(log.event_id);
                            }}
                            className="font-mono text-[var(--accent-brand)] hover:underline font-bold tabular-nums"
                          >
                            #{log.event_id}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${getStageDotColor(log.stage)}`} />
                            <span className="text-xs font-mono text-[var(--ink-primary)] font-medium">
                              {log.stage.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {rationaleText ? (
                            <p className="text-xs text-[var(--ink-primary)] line-clamp-1 leading-relaxed">
                              {isActionSelected && (
                                <span className="text-[var(--accent-brand)] font-semibold mr-1.5 font-mono">[Bandit]</span>
                              )}
                              {rationaleText}
                            </p>
                          ) : (
                            <span className="text-[var(--ink-muted)] font-mono text-[11px]">Telemetry record logged</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => handleCopyPayload(e, log.id, log.details)}
                            className="px-2 py-0.5 rounded bg-[var(--surface-card-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)] text-[11px] font-mono transition-colors"
                          >
                            {copiedId === log.id ? 'Copied' : isExpanded ? 'Hide' : 'Explain'}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-[var(--surface-card-subtle)]">
                          <td colSpan="6" className="p-4 space-y-3">
                            <div className="p-4 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-3 text-xs shadow-sm">
                              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                                <div className="flex items-center space-x-2">
                                  <div className="w-6 h-6 rounded bg-[var(--accent-brand-subtle)] text-[var(--accent-brand)] flex items-center justify-center">
                                    <Cpu size={13} />
                                  </div>
                                  <h4 className="font-heading font-bold text-[var(--ink-primary)]">
                                    Explainability Dossier — Stage: {log.stage}
                                  </h4>
                                </div>
                                <span className="text-[11px] font-mono text-[var(--ink-muted)]">
                                  Actor: {log.actor}
                                </span>
                              </div>

                              <p className="text-xs text-[var(--ink-primary)] leading-relaxed">
                                {rationaleText || 'Standard automated telemetry lifecycle transition recorded.'}
                              </p>

                              <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                                <span className="font-mono text-[11px] text-[var(--ink-muted)] flex items-center">
                                  <FileJson size={12} className="mr-1 text-[var(--accent-brand)]" />
                                  Normalized Payload Data
                                </span>
                                <button
                                  onClick={(e) => handleCopyPayload(e, log.id, log.details)}
                                  className="text-[11px] text-[var(--accent-brand)] hover:underline font-mono"
                                >
                                  Copy JSON
                                </button>
                              </div>

                              <pre className="p-3 rounded bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] font-mono text-[11px] text-[var(--ink-primary)] overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Detail Drawer */}
      <EventDrawer
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
        onEventUpdated={() => fetchLogs()}
      />
    </div>
  );
}
