import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, ArrowRight, RefreshCw, 
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { eventsAPI, pollingAPI } from '../api/client';
import EventDrawer from '../components/EventDrawer';
import { formatRupee, getEventTypeMeta, getStatusMeta, formatRelativeTime } from '../utils/formatters';
import { toast } from 'sonner';

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(null);
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 12;

  const eventTypes = [
    { key: 'all', label: 'All Incidents' },
    { key: 'payment_failed', label: 'Payment Failures' },
    { key: 'checkout_abandoned', label: 'Cart Dropoffs' },
    { key: 'invoice_expired', label: 'Invoices' },
    { key: 'subscription_halted', label: 'Mandates' },
  ];

  const statuses = [
    { key: 'all', label: 'All Lifecycle States' },
    { key: 'new', label: 'Ingested' },
    { key: 'diagnosed', label: 'Diagnosed' },
    { key: 'action_selected', label: 'Policy Selected' },
    { key: 'action_executed', label: 'Dispatched' },
    { key: 'recovered', label: 'Recovered' },
  ];

  useEffect(() => {
    fetchEvents();
  }, [eventTypeFilter, statusFilter, page]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = { page, page_size: pageSize };
      if (eventTypeFilter !== 'all') params.event_type = eventTypeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      
      const res = await eventsAPI.list(params);
      setEvents(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (error) {
      console.error("Failed to fetch events:", error);
      toast.error('Failed to load incidents');
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(evt => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      evt.id.toString().includes(q) ||
      (evt.customer_email && evt.customer_email.toLowerCase().includes(q)) ||
      (evt.customer_contact && evt.customer_contact.toLowerCase().includes(q)) ||
      (evt.razorpay_entity_id && evt.razorpay_entity_id.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold text-[var(--ink-primary)] tracking-tight">
            Revenue Recovery Incidents
          </h1>
          <p className="text-[var(--ink-muted)] text-xs mt-0.5">
            Real-time audit log of intercepted gateway declines, dropoffs, and settlement telemetry.
          </p>
        </div>

        <button
          onClick={() => fetchEvents()}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--ink-primary)] text-xs font-semibold shadow-sm transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Simple Type Filters */}
        <div className="flex flex-wrap gap-1">
          {eventTypes.map((tab) => {
            const isActive = eventTypeFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setEventTypeFilter(tab.key);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  isActive 
                    ? 'bg-[var(--accent-brand-subtle)] text-[var(--accent-brand)] font-semibold border border-[var(--accent-brand)]/20' 
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Input & State Selector */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[var(--ink-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ID, email, entity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] text-[var(--ink-primary)] text-xs rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:border-[var(--accent-brand)] font-mono placeholder-[var(--ink-tertiary)]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] text-[var(--ink-muted)] text-xs rounded-md px-2.5 py-1.5 focus:outline-none font-mono"
          >
            {statuses.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Events Table */}
      <div className="rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] font-mono text-[var(--ink-muted)] bg-[var(--surface-card-subtle)] border-b border-[var(--border-subtle)] uppercase">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Incident ID</th>
                <th className="px-4 py-2.5 font-semibold">Archetype</th>
                <th className="px-4 py-2.5 font-semibold text-right">At-Risk (₹)</th>
                <th className="px-4 py-2.5 font-semibold">Customer / Target</th>
                <th className="px-4 py-2.5 font-semibold">Gateway Object</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold text-right">Detected</th>
                <th className="px-4 py-2.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-[var(--ink-muted)]">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[var(--accent-brand)]" />
                      <span className="font-mono text-xs">Querying database...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-10 text-center text-[var(--ink-muted)] font-mono">
                    No matching incidents found in database.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => {
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

                      <td className="px-4 py-3 text-[var(--ink-muted)] font-mono truncate max-w-[180px]">
                        {evt.customer_email || 'anonymous@demo.com'}
                      </td>

                      <td className="px-4 py-3 text-[var(--ink-muted)] font-mono text-[11px] truncate max-w-[140px]">
                        {evt.razorpay_entity_id || evt.razorpay_order_id || 'rzp_object'}
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

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 bg-[var(--surface-card-subtle)] border-t border-[var(--border-subtle)] flex items-center justify-between text-xs font-mono text-[var(--ink-muted)]">
            <span>
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex space-x-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-2 py-1 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] disabled:opacity-40"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-2 py-1 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] disabled:opacity-40"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Detail Drawer */}
      <EventDrawer
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
        onEventUpdated={() => fetchEvents()}
      />
    </div>
  );
}
