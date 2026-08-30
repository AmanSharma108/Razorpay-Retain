import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, CheckCircle2, XCircle, RefreshCw, AlertTriangle, 
  ArrowRight, X
} from 'lucide-react';
import { reviewAPI } from '../api/client';
import EventDrawer from '../components/EventDrawer';
import { getEventTypeMeta, formatRelativeTime } from '../utils/formatters';
import { triggerConfetti } from '../utils/confetti';
import { toast } from 'sonner';

export default function ReviewQueue() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [rejectModalItem, setRejectModalItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewerName, setReviewerName] = useState('Risk Ops Specialist');
  const [selectedEventId, setSelectedEventId] = useState(null);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await reviewAPI.getQueue();
      setQueue(res.data || []);
      window.dispatchEvent(new CustomEvent('review-queue-changed', { detail: { count: res.data?.length || 0 } }));
    } catch (error) {
      console.error("Failed to fetch review queue:", error);
      toast.error('Failed to load review queue');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (item) => {
    setActionLoadingId(item.id);
    setQueue(prev => prev.filter(q => q.id !== item.id));
    window.dispatchEvent(new CustomEvent('review-queue-changed', { detail: { delta: -1 } }));

    try {
      await reviewAPI.approve(item.id, {
        reviewed_by: reviewerName,
        review_reason: "Approved by operator for autonomous execution"
      });
      triggerConfetti();
      toast.success(`Approved & Executed: Action #${item.id}`, {
        description: `Dispatched ${item.proposed_action} for ${item.amount_display}`
      });
      const countRes = await reviewAPI.getCount();
      window.dispatchEvent(new CustomEvent('review-queue-changed', { detail: { count: countRes.data.count } }));
    } catch (error) {
      console.error("Approval failed:", error);
      toast.error('Failed to approve action');
      fetchQueue();
    } finally {
      setActionLoadingId(null);
    }
  };

  const openRejectModal = (item) => {
    setRejectModalItem(item);
    setRejectReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('A justification reason is required to reject');
      return;
    }
    if (!rejectModalItem) return;

    const item = rejectModalItem;
    setActionLoadingId(item.id);
    setQueue(prev => prev.filter(q => q.id !== item.id));
    window.dispatchEvent(new CustomEvent('review-queue-changed', { detail: { delta: -1 } }));
    setRejectModalItem(null);

    try {
      await reviewAPI.reject(item.id, {
        reviewed_by: reviewerName,
        review_reason: rejectReason.trim()
      });
      toast.info(`Rejected Action #${item.id}`, {
        description: `Execution halted: "${rejectReason.trim()}"`
      });
      const countRes = await reviewAPI.getCount();
      window.dispatchEvent(new CustomEvent('review-queue-changed', { detail: { count: countRes.data.count } }));
    } catch (error) {
      console.error("Rejection failed:", error);
      toast.error('Failed to reject action');
      fetchQueue();
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl font-heading font-bold text-[var(--ink-primary)] tracking-tight">
              Pending Human Review Queue
            </h1>
            {queue.length > 0 && (
              <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[var(--status-warning-subtle)] border border-[var(--status-warning)]/30 text-[var(--status-warning)] font-mono text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)]" />
                <span>{queue.length} Awaiting Sign-off</span>
              </span>
            )}
          </div>
          <p className="text-[var(--ink-muted)] text-xs mt-0.5">
            Risk-gated interventions paused for operator verification prior to execution.
          </p>
        </div>

        <button
          onClick={fetchQueue}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--ink-primary)] text-xs font-semibold shadow-sm transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Policy Rationale Banner */}
      <div className="p-4 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] text-xs space-y-2">
        <div className="flex items-center justify-between text-[var(--ink-muted)]">
          <span className="font-heading font-bold text-[var(--ink-primary)] flex items-center">
            <ShieldAlert size={14} className="text-[var(--status-warning)] mr-1.5" />
            Human Review Gate Trigger Policies
          </span>
          <span className="text-[10px] font-mono text-[var(--accent-brand)] uppercase font-semibold">
            Verifier Guard: Enforced
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-2.5 rounded bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)]">
            <span className="font-semibold text-[var(--status-warning)] block text-[11px] mb-0.5 font-mono">
              1. High-Value Safeguard
            </span>
            <span className="text-[11px] text-[var(--ink-muted)] leading-relaxed">
              Transactions &gt; ₹10,000 (1,000,000 paise) require commercial oversight.
            </span>
          </div>
          <div className="p-2.5 rounded bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)]">
            <span className="font-semibold text-[var(--status-warning)] block text-[11px] mb-0.5 font-mono">
              2. Margin Concessions
            </span>
            <span className="text-[11px] text-[var(--ink-muted)] leading-relaxed">
              Financial discounts, waivers, and refund policies require human sign-off.
            </span>
          </div>
          <div className="p-2.5 rounded bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)]">
            <span className="font-semibold text-[var(--status-warning)] block text-[11px] mb-0.5 font-mono">
              3. Systemic Incidents
            </span>
            <span className="text-[11px] text-[var(--ink-muted)] leading-relaxed">
              Bank gateway downtime or mass churn alerts require human incident command.
            </span>
          </div>
        </div>
      </div>

      {/* Queue Items */}
      {loading ? (
        <div className="p-12 text-center text-[var(--ink-muted)] rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)]">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--accent-brand)]" />
          <span className="font-mono text-xs">Loading review queue proposals...</span>
        </div>
      ) : queue.length === 0 ? (
        <div className="p-12 text-center rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] space-y-3">
          <div className="w-9 h-9 rounded-full bg-[var(--status-success-subtle)] text-[var(--status-success)] flex items-center justify-center mx-auto">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <h3 className="text-sm font-heading font-bold text-[var(--ink-primary)]">
              Review Queue is Clear
            </h3>
            <p className="text-xs text-[var(--ink-muted)] mt-0.5">
              All high-risk and high-value recovery proposals have been verified and processed.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {queue.map((item) => {
            const typeMeta = getEventTypeMeta(item.loss_type);
            const isProcessing = actionLoadingId === item.id;

            return (
              <div
                key={item.id}
                className="p-5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] hover:border-[var(--border-strong)] transition-all space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xs font-mono font-bold text-[var(--accent-brand)]">
                      Proposal #{item.id}
                    </span>
                    <button
                      onClick={() => setSelectedEventId(item.event_id)}
                      className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink-primary)] underline font-mono"
                    >
                      (Incident #{item.event_id})
                    </button>
                    <div className="flex items-center space-x-1.5 pl-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${typeMeta.dotColor}`} />
                      <span className="text-xs font-medium text-[var(--ink-muted)]">
                        {typeMeta.label}
                      </span>
                    </div>
                    {item.is_systemic && (
                      <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[var(--status-error-subtle)] border border-[var(--status-error)]/30 text-[var(--status-error)] text-[10px] font-mono font-bold">
                        <AlertTriangle size={10} />
                        <span>Systemic Alert</span>
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-mono text-[var(--ink-muted)] tabular-nums">
                    Detected {formatRelativeTime(item.created_at)}
                  </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
                  {/* Amount Column with Dominant Tabular Metric */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)] block">
                      At-Risk Revenue
                    </span>
                    <div className="text-xl font-bold font-mono text-[var(--status-warning)] tracking-tight tabular-nums">
                      {item.amount_display}
                    </div>
                    <span className="text-[11px] text-[var(--ink-muted)] font-mono block truncate">
                      {item.customer_email || 'No email provided'}
                    </span>
                  </div>

                  {/* Diagnosis Column */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)] block">
                      Diagnostic Root Cause
                    </span>
                    <div className="text-xs font-semibold text-[var(--ink-primary)] font-mono">
                      {item.diagnosis_category}
                    </div>
                    <span className="text-[11px] text-[var(--ink-muted)] font-mono block tabular-nums">
                      Confidence: {(item.confidence * 100).toFixed(0)}% • Severity: {item.severity}/5
                    </span>
                  </div>

                  {/* Proposed Action Column */}
                  <div className="space-y-1 md:col-span-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)] block">
                      Thompson Bandit Proposal
                    </span>
                    <div className="text-xs font-bold text-[var(--accent-brand)] font-mono">
                      {item.proposed_action}
                    </div>
                    <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed font-sans">
                      {item.actor_justification}
                    </p>
                  </div>
                </div>

                {/* Trigger Reasons Tag Row */}
                {item.review_trigger_reasons && item.review_trigger_reasons.length > 0 && (
                  <div className="p-2.5 rounded bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[var(--ink-muted)] text-[11px] font-medium">Trigger Rule:</span>
                    {item.review_trigger_reasons.map((trig, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-[var(--status-warning-subtle)] text-[var(--status-warning)] border border-[var(--status-warning)]/20 text-[10px] font-mono font-medium"
                      >
                        {trig}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions Row */}
                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <button
                    onClick={() => setSelectedEventId(item.event_id)}
                    className="text-xs text-[var(--ink-muted)] hover:text-[var(--accent-brand)] flex items-center transition-colors font-medium"
                  >
                    <span>Inspect incident telemetry</span>
                    <ArrowRight size={11} className="ml-1" />
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => openRejectModal(item)}
                      disabled={isProcessing}
                      className="px-3 py-1.5 rounded-md bg-[var(--surface-card-subtle)] hover:bg-[var(--status-error-subtle)] text-[var(--status-error)] border border-[var(--border-subtle)] hover:border-[var(--status-error)]/30 text-xs font-semibold transition-colors flex items-center space-x-1.5 disabled:opacity-40"
                    >
                      <XCircle size={13} />
                      <span>Reject</span>
                    </button>

                    <button
                      onClick={() => handleApprove(item)}
                      disabled={isProcessing}
                      className="px-3.5 py-1.5 rounded-md bg-[var(--accent-brand)] hover:bg-[var(--accent-brand-hover)] text-white text-xs font-semibold shadow-sm transition-colors flex items-center space-x-1.5 disabled:opacity-40"
                    >
                      <CheckCircle2 size={13} />
                      <span>{isProcessing ? 'Executing...' : 'Approve & Execute'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Confirmation Dialog */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 bg-[#0B1220]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--surface-card)] border border-[var(--border-strong)] rounded-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-md bg-[var(--status-error-subtle)] text-[var(--status-error)] flex items-center justify-center">
                  <XCircle size={16} />
                </div>
                <h3 className="text-sm font-heading font-bold text-[var(--ink-primary)]">Reject Recovery Proposal</h3>
              </div>
              <button
                onClick={() => setRejectModalItem(null)}
                className="text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-[var(--ink-muted)]">
              Rejecting Action #{rejectModalItem.id} halts execution permanently. An immutable cryptographic audit record will be logged.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[var(--ink-muted)] block mb-1 font-medium">Reviewer Signature</label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  className="w-full bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] rounded-md px-3 py-1.5 text-[var(--ink-primary)] focus:outline-none focus:border-[var(--accent-brand)] font-mono"
                />
              </div>

              <div>
                <label className="text-[var(--ink-muted)] block mb-1 font-medium">
                  Rejection Justification <span className="text-[var(--status-error)]">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Confirmed bank gateway maintenance outage; holding automated retry..."
                  className="w-full bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] rounded-md p-2.5 text-[var(--ink-primary)] focus:outline-none focus:border-[var(--accent-brand)] font-mono placeholder-[var(--ink-tertiary)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => setRejectModalItem(null)}
                className="px-3 py-1.5 rounded-md bg-[var(--surface-card-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)] text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={!rejectReason.trim() || actionLoadingId}
                className="px-3.5 py-1.5 rounded-md bg-[var(--status-error)] hover:bg-[var(--status-error)]/90 text-white text-xs font-semibold transition-colors disabled:opacity-40"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Detail Drawer */}
      <EventDrawer
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
        onEventUpdated={() => fetchQueue()}
      />
    </div>
  );
}
