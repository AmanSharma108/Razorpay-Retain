import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  IndianRupee, TrendingUp, Percent, Activity, RefreshCw, 
  ArrowRight, ShieldAlert
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import StatCard from '../components/StatCard';
import EventDrawer from '../components/EventDrawer';
import AIInsightsCard from '../components/AIInsightsCard';
import { dashboardAPI, eventsAPI, pollingAPI } from '../api/client';
import { formatRupee, formatCompactRupee, getEventTypeMeta, getStatusMeta, formatRelativeTime } from '../utils/formatters';
import { triggerConfetti } from '../utils/confetti';
import { toast } from 'sonner';

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [summaryRes, analyticsRes, eventsRes] = await Promise.all([
        dashboardAPI.getSummary(),
        dashboardAPI.getAnalytics(),
        eventsAPI.list({ page_size: 7 })
      ]);
      setSummary(summaryRes.data);
      setAnalytics(analyticsRes.data || []);
      setRecentEvents(eventsRes.data.items || []);
      if (isManual) toast.success('Telemetry updated');
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      toast.error('Failed to sync telemetry');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAutonomousAction = async () => {
    try {
      const res = await pollingAPI.triggerPoll();
      toast.success(`Gateway Sync: ${res.data.new_events} incidents ingested`);
      await fetchDashboardData();
    } catch {
      // ignore
    }
  };

  const COLORS = {
    payment_failed: '#E5484D', 
    checkout_abandoned: '#F5A623', 
    invoice_expired: '#3395FF', 
    subscription_halted: '#64748B',
    unknown: '#94A3B8'
  };

  const pieData = summary?.events_by_type 
    ? Object.entries(summary.events_by_type).map(([name, value]) => ({ 
        name, 
        value,
        displayName: name.replace('_', ' ')
      }))
    : [];

  const trendData = analytics.length > 0 ? analytics.map(d => ({
    date: d.date,
    at_risk: d.at_risk / 100,
    recovered: d.recovered / 100
  })) : [
    { date: 'Day 1', at_risk: 12000, recovered: 7800 },
    { date: 'Day 2', at_risk: 18500, recovered: 12400 },
    { date: 'Day 3', at_risk: 15200, recovered: 10100 },
    { date: 'Day 4', at_risk: 24000, recovered: 18900 },
    { date: 'Day 5', at_risk: 31000, recovered: 22400 },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <RefreshCw className="text-[var(--ink-muted)] animate-spin" size={20} />
        <p className="text-xs text-[var(--ink-muted)] font-mono">Loading telemetry cockpit...</p>
      </div>
    );
  }

  const recoveryRate = summary?.recovery_rate !== undefined 
    ? Number(summary.recovery_rate).toFixed(1) 
    : '0.0';

  return (
    <div className="space-y-6">
      {/* Top Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold text-[var(--ink-primary)] tracking-tight">
            Revenue Recovery Cockpit
          </h1>
          <p className="text-[var(--ink-muted)] text-xs mt-0.5">
            Autonomous detection, root-cause diagnosis, and policy-governed intervention engine.
          </p>
        </div>

        <button
          onClick={() => fetchDashboardData(true)}
          disabled={refreshing}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--ink-primary)] text-xs font-semibold shadow-sm transition-colors"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          <span>Sync Gateway</span>
        </button>
      </div>

      {/* Stat Cards Grid (5 cards with visual numeric dominance) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard 
          title="At-Risk Revenue" 
          value={formatRupee(summary?.total_at_risk)} 
          subtitle="Intercepted dropoff"
          icon={<IndianRupee size={15} />} 
          color="amber" 
        />
        <StatCard 
          title="Revenue Recovered" 
          value={formatRupee(summary?.total_recovered)} 
          subtitle="Saved by orchestrator"
          icon={<TrendingUp size={15} />} 
          color="green" 
          trend="+38.4%"
          onClick={triggerConfetti}
        />
        <StatCard 
          title="Recovery Win Rate" 
          value={`${recoveryRate}%`} 
          subtitle="Bandit posterior mean"
          icon={<Percent size={15} />} 
          color="green" 
        />
        <StatCard 
          title="Active Incidents" 
          value={summary?.active_events || 0} 
          subtitle="In diagnosis & retry"
          icon={<Activity size={15} />} 
          color="blue" 
        />
        <StatCard 
          title="Pending Approvals" 
          value={summary?.pending_reviews || 0} 
          subtitle="Requiring HITL sign-off"
          icon={<ShieldAlert size={15} className="text-[var(--status-warning)]" />} 
          color="amber"
          onClick={() => navigate('/reviews')}
        />
      </div>

      {/* AI Strategy Heuristics */}
      <AIInsightsCard 
        summary={summary} 
        onTriggerAutonomousAction={handleAutonomousAction} 
      />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Trend Area Chart (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                Recovery Trajectory Performance
              </h3>
            </div>
            <div className="flex items-center space-x-4 text-xs font-mono">
              <span className="flex items-center text-[var(--ink-muted)]">
                <span className="w-2 h-2 rounded-full bg-[#F5A623] mr-1.5" /> At Risk
              </span>
              <span className="flex items-center text-[var(--ink-muted)]">
                <span className="w-2 h-2 rounded-full bg-[#0F9D58] mr-1.5" /> Recovered
              </span>
            </div>
          </div>

          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="recoveredGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F9D58" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0F9D58" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="atRiskGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F5A623" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#F5A623" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--ink-tertiary)" tick={{fill: 'var(--ink-muted)', fontSize: 11, fontFamily: 'var(--font-mono)'}} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--ink-tertiary)" tick={{fill: 'var(--ink-muted)', fontSize: 11, fontFamily: 'var(--font-mono)'}} axisLine={false} tickLine={false} tickFormatter={(val) => formatCompactRupee(val, false)} />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[var(--surface-card)] border border-[var(--border-strong)] p-2.5 rounded-md text-xs space-y-1 text-[var(--ink-primary)] shadow-lg font-mono">
                          <p className="font-semibold text-[var(--ink-muted)] border-b border-[var(--border-subtle)] pb-1">{label}</p>
                          <p className="text-[#F5A623]">At Risk: {formatRupee(payload[0]?.value, false)}</p>
                          <p className="text-[#0F9D58]">Recovered: {formatRupee(payload[1]?.value, false)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="at_risk" stroke="#F5A623" strokeWidth={1.5} fillOpacity={1} fill="url(#atRiskGradient)" />
                <Area type="monotone" dataKey="recovered" stroke="#0F9D58" strokeWidth={2} fillOpacity={1} fill="url(#recoveredGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown Pie Chart (1 col) */}
        <div className="p-5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] flex flex-col justify-between">
          <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[var(--ink-muted)]">
            Dropoff Archetype Distribution
          </h3>

          <div className="h-[180px] w-full flex items-center justify-center my-1">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#3395FF'} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--surface-card)', borderColor: 'var(--border-strong)', borderRadius: '6px', fontSize: '11px', color: 'var(--ink-primary)', fontFamily: 'var(--font-mono)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-[var(--ink-tertiary)] font-mono">No incidents logged</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1 text-xs font-mono">
            {pieData.map((item, idx) => (
              <div key={idx} className="flex items-center space-x-1.5 p-1 rounded bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)]">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[item.name] || '#3395FF' }} />
                <span className="text-[var(--ink-muted)] truncate capitalize text-[10px]">{item.displayName}</span>
                <span className="ml-auto text-[var(--ink-primary)] text-[10px] font-bold tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Incidents Table with Status Hover Left-Border & Right-Aligned Tabular Figures */}
      <div className="rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[var(--ink-muted)]">
            Recent Gateway Interceptions
          </h3>
          <span className="text-xs text-[var(--ink-muted)] font-mono">{recentEvents.length} events</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] font-mono text-[var(--ink-muted)] bg-[var(--surface-card-subtle)] border-b border-[var(--border-subtle)] uppercase">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Incident ID</th>
                <th className="px-4 py-2.5 font-semibold">Archetype</th>
                <th className="px-4 py-2.5 font-semibold text-right">At-Risk (₹)</th>
                <th className="px-4 py-2.5 font-semibold">Customer / Target</th>
                <th className="px-4 py-2.5 font-semibold">Lifecycle Status</th>
                <th className="px-4 py-2.5 font-semibold text-right">Detected</th>
                <th className="px-4 py-2.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {recentEvents.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-[var(--ink-muted)] font-mono">
                    No active incidents. Launch a test transaction in the Live Checkout Sandbox.
                  </td>
                </tr>
              ) : (
                recentEvents.map((evt) => {
                  const typeMeta = getEventTypeMeta(evt.event_type);
                  const statusMeta = getStatusMeta(evt.status);

                  return (
                    <tr
                      key={evt.id}
                      onClick={() => setSelectedEventId(evt.id)}
                      className={`table-row-status ${typeMeta.statusClass} cursor-pointer transition-colors`}
                    >
                      <td className="px-4 py-3 font-mono font-medium text-[var(--accent-brand)] tabular-nums">
                        #{evt.id}
                      </td>
                      <td className="px-4 py-3 text-[var(--ink-primary)] font-medium">
                        <div className="flex items-center space-x-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${typeMeta.dotColor}`} />
                          <span>{typeMeta.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-[var(--ink-primary)] text-right tabular-nums">
                        {formatRupee(evt.amount_at_risk)}
                      </td>
                      <td className="px-4 py-3 text-[var(--ink-muted)] font-mono truncate max-w-[200px]">
                        {evt.customer_email || 'customer@gateway.in'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotColor}`} />
                          <span className="text-[var(--ink-muted)] font-medium text-xs">
                            {statusMeta.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--ink-muted)] font-mono text-right tabular-nums">
                        {formatRelativeTime(evt.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[var(--ink-muted)] hover:text-[var(--accent-brand)] inline-flex items-center text-xs font-medium">
                          Inspect <ArrowRight size={11} className="ml-1" />
                        </span>
                      </td>
                    </tr>
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
        onEventUpdated={() => fetchDashboardData()}
      />
    </div>
  );
}
