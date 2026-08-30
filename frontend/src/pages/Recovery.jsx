import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, ArrowRight
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell 
} from 'recharts';
import { recoveryAPI } from '../api/client';
import EventDrawer from '../components/EventDrawer';
import BanditCurves from '../components/BanditCurves';
import { formatRupee, formatRelativeTime } from '../utils/formatters';
import { toast } from 'sonner';

export default function Recovery() {
  const [actions, setActions] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [actionsRes, statsRes] = await Promise.all([
        recoveryAPI.listActions({ page_size: 20 }).catch(() => ({ data: { items: [] } })),
        recoveryAPI.getPolicyStats().catch(() => ({ data: [] }))
      ]);
      
      setActions(actionsRes.data.items || []);
      setStats(statsRes.data || []);
    } catch (error) {
      console.error("Failed to fetch recovery data:", error);
      toast.error('Failed to load recovery data');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (eventId) => {
    setRetryingId(eventId);
    try {
      await recoveryAPI.retryAction(eventId);
      toast.success(`Dispatched retry for Incident #${eventId}`);
      await fetchData();
    } catch (error) {
      console.error("Retry failed:", error);
      toast.error('Failed to retry');
    } finally {
      setRetryingId(null);
    }
  };

  const chartData = stats.map(s => ({
    name: s.action_type.replace(/_/g, ' '),
    action_type: s.action_type,
    event_type: s.event_type,
    success_rate: (s.success_rate * 100).toFixed(1),
    attempts: s.total_attempts,
    successes: s.total_successes,
    alpha: s.alpha,
    beta: s.beta_param
  }));

  const getActionColor = (actionType) => {
    const map = {
      send_retry_link: '#3395FF',
      send_reminder_email: '#F5A623',
      offer_alternate_method: '#0F9D58',
      auto_retry_payment: '#3395FF',
      send_invoice_reminder: '#F5A623',
      escalate_to_support: '#E5484D',
      apply_discount: '#0F9D58',
    };
    return map[actionType] || '#3395FF';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold text-[var(--ink-primary)] tracking-tight">
            Bayesian Recovery Policy Bandit
          </h1>
          <p className="text-[var(--ink-muted)] text-xs mt-0.5">
            Thompson Sampling multi-armed bandit algorithm continuously optimizing recovery rails.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--ink-primary)] text-xs font-semibold shadow-sm transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Sync Policy</span>
        </button>
      </div>

      {/* Posterior Probability Density Curves */}
      <BanditCurves stats={stats} />

      {/* Policy Statistics Chart Card */}
      <div className="p-5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] space-y-4">
        <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[var(--ink-muted)]">
          Conversion Win-Rates by Policy Action Arm
        </h3>

        <div className="h-[220px] w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--ink-tertiary)" tick={{fill: 'var(--ink-muted)', fontSize: 10, fontFamily: 'var(--font-mono)'}} />
                <YAxis stroke="var(--ink-tertiary)" tick={{fill: 'var(--ink-muted)', fontSize: 10, fontFamily: 'var(--font-mono)'}} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[var(--surface-card)] border border-[var(--border-strong)] p-2.5 rounded-md text-xs space-y-1 text-[var(--ink-primary)] font-mono shadow-lg">
                          <p className="font-semibold text-[var(--accent-brand)] capitalize">{data.name}</p>
                          <p className="text-[var(--status-success)]">Win Rate: {data.success_rate}%</p>
                          <p className="text-[var(--ink-muted)]">Attempts: {data.attempts} (Recovered: {data.successes})</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="success_rate" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getActionColor(entry.action_type)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[var(--ink-muted)] font-mono text-xs">
              No bandit trials recorded yet.
            </div>
          )}
        </div>

        {/* Policy Stats Table */}
        <div className="overflow-x-auto pt-2 border-t border-[var(--border-subtle)]">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] font-mono text-[var(--ink-muted)] bg-[var(--surface-card-subtle)] uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">Incident Archetype</th>
                <th className="px-3 py-2 font-semibold">Action Arm</th>
                <th className="px-3 py-2 font-semibold text-right">Dispatches</th>
                <th className="px-3 py-2 font-semibold text-right">Recoveries</th>
                <th className="px-3 py-2 font-semibold text-right">Win Rate</th>
                <th className="px-3 py-2 font-semibold text-right">Posterior Parameters</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] font-mono text-xs">
              {stats.map((stat, idx) => (
                <tr key={idx} className="hover:bg-[var(--surface-hover)] transition-colors">
                  <td className="px-3 py-2 text-[var(--ink-primary)] font-sans">{stat.event_type}</td>
                  <td className="px-3 py-2 text-[var(--accent-brand)] font-sans font-medium">{stat.action_type}</td>
                  <td className="px-3 py-2 text-[var(--ink-muted)] text-right tabular-nums">{stat.total_attempts}</td>
                  <td className="px-3 py-2 text-[var(--status-success)] text-right font-bold tabular-nums">{stat.total_successes}</td>
                  <td className="px-3 py-2 text-[var(--status-success)] text-right font-bold tabular-nums">{(stat.success_rate * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-[var(--ink-muted)] text-right tabular-nums">α={stat.alpha} β={stat.beta_param}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatched Actions Table */}
      <div className="rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[var(--ink-muted)]">Recent Dispatched Interventions</h3>
          <span className="text-xs font-mono text-[var(--ink-muted)]">{actions.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] font-mono text-[var(--ink-muted)] bg-[var(--surface-card-subtle)] border-b border-[var(--border-subtle)] uppercase">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Action ID</th>
                <th className="px-4 py-2.5 font-semibold">Incident</th>
                <th className="px-4 py-2.5 font-semibold">Action Type</th>
                <th className="px-4 py-2.5 font-semibold">Execution Status</th>
                <th className="px-4 py-2.5 font-semibold">Outcome</th>
                <th className="px-4 py-2.5 font-semibold text-right">Recovered Amount</th>
                <th className="px-4 py-2.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {actions.map((act) => {
                const isSuccess = act.outcome?.success === true;
                const isFailed = act.outcome?.success === false;

                return (
                  <tr
                    key={act.id}
                    onClick={() => setSelectedEventId(act.event_id)}
                    className="hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-[var(--ink-muted)] tabular-nums">#{act.id}</td>
                    <td className="px-4 py-2.5 font-mono text-[var(--accent-brand)] tabular-nums">#{act.event_id}</td>
                    <td className="px-4 py-2.5 text-[var(--ink-primary)] font-medium">{act.action_type}</td>
                    <td className="px-4 py-2.5 text-[var(--ink-muted)] font-mono text-[11px] capitalize">{act.status.replace('_', ' ')}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center space-x-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isSuccess ? 'bg-[var(--status-success)]' : isFailed ? 'bg-[var(--status-error)]' : 'bg-[var(--status-warning)]'
                        }`} />
                        <span className="text-[var(--ink-muted)] text-xs">
                          {isSuccess ? 'Settled' : isFailed ? 'Declined' : 'Pending'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-[var(--ink-primary)] text-right tabular-nums">
                      {act.outcome?.amount_recovered ? formatRupee(act.outcome.amount_recovered) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetry(act.event_id);
                        }}
                        disabled={retryingId === act.event_id}
                        className="text-[var(--ink-muted)] hover:text-[var(--accent-brand)] text-xs transition-colors font-medium"
                      >
                        {retryingId === act.event_id ? 'Retrying...' : 'Re-evaluate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Detail Drawer */}
      <EventDrawer
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
        onEventUpdated={() => fetchData()}
      />
    </div>
  );
}
