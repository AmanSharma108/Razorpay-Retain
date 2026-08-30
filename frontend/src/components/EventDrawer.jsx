import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, RefreshCw, CheckCircle2, Clock, 
  ExternalLink, Mail, Phone, Cpu, 
  Check, FileJson, Sparkles, ShieldAlert
} from 'lucide-react';
import { eventsAPI, recoveryAPI, reviewAPI, pollingAPI } from '../api/client';
import { formatRupee, getEventTypeMeta, getStatusMeta, formatRelativeTime } from '../utils/formatters';
import { triggerConfetti } from '../utils/confetti';
import { toast } from 'sonner';

export default function EventDrawer({ eventId, onClose, onEventUpdated }) {
  const [eventDetail, setEventDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncingRecovery, setSyncingRecovery] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [approvingReview, setApprovingReview] = useState(false);

  useEffect(() => {
    if (eventId) {
      fetchDetail();
    }
  }, [eventId]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await eventsAPI.get(eventId);
      setEventDetail(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckSettlement = async () => {
    setSyncingRecovery(true);
    try {
      await pollingAPI.triggerPoll();
      toast.info('Queried Razorpay Gateway APIs', {
        description: `Checked recent payments & settlements.`
      });
      await fetchDetail();
      if (onEventUpdated) onEventUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Failed to check gateway status');
    } finally {
      setSyncingRecovery(false);
    }
  };

  const handleRetryAction = async () => {
    setRetrying(true);
    try {
      await recoveryAPI.retryAction(eventId);
      toast.success('Action re-evaluated via learning policy');
      window.dispatchEvent(new CustomEvent('review-queue-changed', {}));
      await fetchDetail();
      if (onEventUpdated) onEventUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Retry action failed');
    } finally {
      setRetrying(false);
    }
  };

  const handleApprovePendingAction = async (actionId) => {
    setApprovingReview(true);
    window.dispatchEvent(new CustomEvent('review-queue-changed', { detail: { delta: -1 } }));

    try {
      await reviewAPI.approve(actionId, {
        reviewed_by: "Risk Ops Specialist",
        review_reason: "Approved from Event Inspector"
      });
      triggerConfetti();
      toast.success('Approved and executed recovery action');
      const countRes = await reviewAPI.getCount();
      window.dispatchEvent(new CustomEvent('review-queue-changed', { detail: { count: countRes.data.count } }));
      await fetchDetail();
      if (onEventUpdated) onEventUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Approval failed');
      window.dispatchEvent(new CustomEvent('review-queue-changed', {}));
    } finally {
      setApprovingReview(false);
    }
  };

  if (!eventId) return null;

  const typeMeta = eventDetail ? getEventTypeMeta(eventDetail.event_type) : getEventTypeMeta('unknown');
  const statusMeta = eventDetail ? getStatusMeta(eventDetail.status) : getStatusMeta('new');
  const diagnosis = eventDetail?.diagnoses?.[0];
  const activeAction = eventDetail?.recovery_actions?.[0];
  const outcome = activeAction?.outcome;
  const isPendingReview = activeAction?.review_status === 'pending';

  const pipelineStages = [
    { key: 'ingested', label: '1. Ingestion', status: 'done', desc: 'Webhook / Polling Normalizer' },
    { 
      key: 'diagnosed', 
      label: '2. Polymorphic Diagnosis', 
      status: diagnosis ? 'done' : 'pending',
      desc: diagnosis ? diagnosis.root_cause : 'Pending' 
    },
    { 
      key: 'action_selected', 
      label: '3. Bandit Policy', 
      status: activeAction ? 'done' : 'pending',
      desc: activeAction ? activeAction.action_type : 'Evaluating' 
    },
    { 
      key: 'review_gate', 
      label: '4. Verifier & Review Gate', 
      status: activeAction?.review_status === 'approved' || activeAction?.review_status === 'not_required'
        ? 'done' 
        : activeAction?.review_status === 'pending'
        ? 'waiting'
        : activeAction?.review_status === 'rejected'
        ? 'failed'
        : 'pending',
      desc: activeAction?.review_status === 'approved'
        ? 'Human Approved'
        : activeAction?.review_status === 'pending'
        ? 'Pending Human Review'
        : activeAction?.review_status === 'rejected'
        ? 'Human Rejected'
        : 'Auto-Approved'
    },
    { 
      key: 'action_executed', 
      label: '5. Action Dispatch', 
      status: activeAction?.status === 'executed' || activeAction?.status?.startsWith('verified') ? 'done' : 'pending',
      desc: activeAction?.executed_at ? 'Dispatched' : isPendingReview ? 'Paused (Review)' : 'Queued'
    },
    { 
      key: 'recovered', 
      label: '6. Outcome & Verification', 
      status: outcome?.success || eventDetail?.status === 'recovered' ? 'success' : outcome?.success === false ? 'failed' : 'waiting',
      desc: eventDetail?.status === 'recovered' ? 'Recovered' : 'Awaiting Settlement'
    }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#0B1220]/50 backdrop-blur-sm"
        />

        {/* Drawer Window */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 240 }}
          className="relative w-full max-w-2xl bg-[var(--surface-card)] border-l border-[var(--border-subtle)] text-[var(--ink-primary)] shadow-2xl flex flex-col h-full z-10"
        >
          {/* Header */}
          <div className="p-6 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--surface-card)]">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--accent-brand-subtle)] border border-[var(--accent-brand)]/20 flex items-center justify-center text-[var(--accent-brand)] font-mono font-bold text-xs">
                #{eventId}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-heading font-bold text-[var(--ink-primary)] tracking-tight">
                    Incident Telemetry
                  </h2>
                  <div className="flex items-center space-x-1.5 pl-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${typeMeta.dotColor}`} />
                    <span className="text-xs font-medium text-[var(--ink-muted)]">
                      {typeMeta.label}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[var(--ink-muted)] font-mono mt-0.5 tabular-nums">
                  Entity: {eventDetail?.razorpay_entity_id || 'rzp_object'} • Detected {formatRelativeTime(eventDetail?.created_at)}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)] hover:border-[var(--border-strong)] transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--accent-brand)] border-t-transparent animate-spin" />
                <p className="text-xs text-[var(--ink-muted)] font-mono">Fetching event telemetry...</p>
              </div>
            ) : eventDetail ? (
              <>
                {/* Revenue Overview Card */}
                <div className="p-4 rounded-lg bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-[var(--ink-muted)] uppercase tracking-wider font-semibold">
                      At-Risk Revenue
                    </span>
                    <div className="text-2xl font-bold text-[var(--status-warning)] mt-0.5 font-mono tracking-tight tabular-nums">
                      {formatRupee(eventDetail.amount_at_risk)}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-[var(--ink-muted)] uppercase tracking-wider font-semibold">
                      Current Lifecycle State
                    </span>
                    <div className="mt-1 flex items-center justify-end space-x-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotColor}`} />
                      <span className="text-xs font-semibold text-[var(--ink-primary)]">
                        {statusMeta.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pending Approval Callout Banner if applicable */}
                {isPendingReview && (
                  <div className="p-4 rounded-lg bg-[var(--status-warning-subtle)] border border-[var(--status-warning)]/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--status-warning)] flex items-center">
                        <ShieldAlert size={15} className="mr-1.5" />
                        Paused: Awaiting Human Operator Approval
                      </span>
                      <button
                        onClick={() => handleApprovePendingAction(activeAction.id)}
                        disabled={approvingReview}
                        className="px-3 py-1 rounded bg-[var(--accent-brand)] hover:bg-[var(--accent-brand-hover)] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                      >
                        {approvingReview ? 'Approving...' : 'Approve & Dispatch'}
                      </button>
                    </div>
                    <p className="text-[11px] text-[var(--ink-primary)] leading-relaxed">
                      This action requires human review due to transaction value (&gt; ₹10,000) or financial concession policy. Money will not move until approved.
                    </p>
                  </div>
                )}

                {/* Interactive Lifecycle Pipeline Progress */}
                <div className="p-4 rounded-lg bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)]">
                  <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[var(--ink-muted)] mb-3 flex items-center">
                    <Cpu size={14} className="mr-2 text-[var(--accent-brand)]" />
                    Lifecycle Decision Pipeline
                  </h3>

                  <div className="relative pl-6 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border-subtle)]">
                    {pipelineStages.map((stage, idx) => {
                      const isDone = stage.status === 'done' || stage.status === 'success';
                      const isSuccess = stage.status === 'success';
                      const isFailed = stage.status === 'failed';
                      const isWaiting = stage.status === 'waiting';

                      return (
                        <div key={idx} className="relative flex items-start group">
                          {/* Dot indicator */}
                          <div 
                            className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full flex items-center justify-center border transition-all ${
                              isSuccess 
                                ? 'bg-[var(--status-success)] border-[var(--status-success)] text-white' 
                                : isDone 
                                ? 'bg-[var(--accent-brand)] border-[var(--accent-brand)] text-white' 
                                : isWaiting
                                ? 'bg-[var(--status-warning)] border-[var(--status-warning)] text-white'
                                : isFailed
                                ? 'bg-[var(--status-error)] border-[var(--status-error)] text-white'
                                : 'bg-[var(--surface-card)] border-[var(--border-strong)] text-[var(--ink-muted)]'
                            }`}
                          >
                            {isDone || isSuccess ? <Check size={9} strokeWidth={3} /> : <div className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />}
                          </div>

                          <div className="flex-1 ml-2">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-semibold ${isSuccess ? 'text-[var(--status-success)]' : isWaiting ? 'text-[var(--status-warning)]' : isDone ? 'text-[var(--ink-primary)]' : 'text-[var(--ink-muted)]'}`}>
                                {stage.label}
                              </span>
                              <span className="text-[11px] font-mono text-[var(--ink-muted)]">
                                {stage.desc}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Customer Details & Diagnostic Attributes */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-lg bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)]">
                    <span className="text-[11px] text-[var(--ink-muted)] font-semibold uppercase tracking-wider block mb-1.5">
                      Customer Telemetry
                    </span>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center text-[var(--ink-primary)]">
                        <Mail size={12} className="mr-1.5 text-[var(--accent-brand)] shrink-0" />
                        <span className="truncate font-mono">{eventDetail.customer_email || 'Not provided'}</span>
                      </div>
                      <div className="flex items-center text-[var(--ink-primary)]">
                        <Phone size={12} className="mr-1.5 text-[var(--accent-brand)] shrink-0" />
                        <span className="font-mono">{eventDetail.customer_contact || 'Not provided'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)]">
                    <span className="text-[11px] text-[var(--ink-muted)] font-semibold uppercase tracking-wider block mb-1.5">
                      Root Cause Indicators
                    </span>
                    <div className="space-y-1 text-xs font-mono">
                      <div className="text-[var(--ink-primary)]">
                        <span className="text-[var(--ink-muted)]">Source: </span>
                        {eventDetail.error_source || 'gateway'}
                      </div>
                      <div className="text-[var(--ink-primary)] truncate">
                        <span className="text-[var(--ink-muted)]">Reason: </span>
                        {eventDetail.error_reason || 'insufficient_funds'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Diagnosis Breakdown */}
                {diagnosis && (
                  <div className="p-4 rounded-lg bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[var(--ink-muted)] flex items-center">
                        <Cpu size={14} className="mr-1.5 text-[var(--accent-brand)]" />
                        Diagnostic Engine Findings
                      </h3>
                      <div className="flex items-center space-x-2 font-mono text-xs">
                        {diagnosis.is_systemic && (
                          <span className="px-1.5 py-0.2 rounded bg-[var(--status-error-subtle)] text-[var(--status-error)] border border-[var(--status-error)]/20 font-bold text-[10px]">
                            SYSTEMIC
                          </span>
                        )}
                        <span className="text-[var(--ink-muted)]">Confidence:</span>
                        <span className="font-bold text-[var(--status-success)] tabular-nums">
                          {(diagnosis.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className="bg-[var(--surface-card)] p-3 rounded-md border border-[var(--border-subtle)] text-xs text-[var(--ink-primary)]">
                      <p className="font-medium mb-1">{diagnosis.reasoning}</p>
                      <div className="flex items-center space-x-2 mt-2 font-mono text-[11px]">
                        <span className="text-[var(--ink-muted)]">Root cause:</span>
                        <span className="px-2 py-0.5 rounded bg-[var(--surface-card-subtle)] text-[var(--accent-brand)] border border-[var(--border-subtle)] font-bold">
                          {diagnosis.root_cause}
                        </span>
                        <span className="text-[var(--ink-muted)] ml-2">Severity:</span>
                        <span className="text-[var(--status-warning)] font-bold">
                          {'★'.repeat(diagnosis.severity)}{'☆'.repeat(5 - diagnosis.severity)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Recovery Action */}
                {activeAction && (
                  <div className="p-4 rounded-lg bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[var(--ink-muted)] flex items-center">
                        <Sparkles size={14} className="mr-1.5 text-[var(--accent-brand)]" />
                        Recovery Intervention & Link Dispatch
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-[var(--accent-brand-subtle)] text-[var(--accent-brand)] border border-[var(--accent-brand)]/20 font-semibold">
                          {activeAction.action_type}
                        </span>
                      </div>
                    </div>

                    {activeAction.result_details && (() => {
                      let details = activeAction.result_details;
                      if (typeof details === 'string') {
                        try { details = JSON.parse(details); } catch { /* ignore */ }
                      }
                      return (
                        <div className="p-3 rounded-md bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-2">
                          <div className="text-xs font-mono text-[var(--ink-muted)] flex items-center justify-between">
                            <span className="flex items-center">
                              <FileJson size={12} className="mr-1.5 text-[var(--accent-brand)]" />
                              Execution Telemetry
                            </span>
                            {details?.url && (
                              <a
                                href={details.url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 rounded bg-[var(--status-success)] text-white font-bold text-[10px] flex items-center space-x-1 hover:opacity-90 transition-opacity shadow-sm"
                              >
                                <span>Open Real Payment Link</span>
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                          <pre className="text-[11px] font-mono text-[var(--ink-primary)] bg-[var(--surface-card-subtle)] p-2.5 rounded overflow-x-auto whitespace-pre-wrap border border-[var(--border-subtle)]">
                            {JSON.stringify(details, null, 2)}
                          </pre>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Audit Trail Timeline */}
                {eventDetail.audit_entries && eventDetail.audit_entries.length > 0 && (
                  <div className="p-4 rounded-lg bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] space-y-2.5">
                    <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[var(--ink-muted)] flex items-center">
                      <Clock size={14} className="mr-1.5 text-[var(--accent-brand)]" />
                      Audit Trail Telemetry ({eventDetail.audit_entries.length})
                    </h3>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {eventDetail.audit_entries.map((entry, idx) => (
                        <div key={idx} className="p-2 rounded-md bg-[var(--surface-card)] border border-[var(--border-subtle)] flex items-center justify-between text-xs font-mono">
                          <div className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-brand)]" />
                            <span className="font-semibold text-[var(--ink-primary)] uppercase text-[10px]">
                              {entry.stage.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[var(--ink-muted)] text-[11px]">by {entry.actor}</span>
                          </div>
                          <span className="text-[var(--ink-muted)] text-[11px] tabular-nums">
                            {formatRelativeTime(entry.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Footer Action Buttons */}
          <div className="p-5 border-t border-[var(--border-subtle)] bg-[var(--surface-card)] flex items-center justify-between gap-3">
            <button
              onClick={handleRetryAction}
              disabled={retrying || eventDetail?.status === 'recovered'}
              className="flex-1 flex items-center justify-center px-4 py-2 rounded-md bg-[var(--surface-card-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] text-[var(--ink-primary)] text-xs font-semibold transition-all disabled:opacity-40"
            >
              <RefreshCw size={13} className={`mr-2 ${retrying ? 'animate-spin' : ''}`} />
              Re-evaluate Policy
            </button>

            <button
              onClick={handleCheckSettlement}
              disabled={syncingRecovery || eventDetail?.status === 'recovered' || isPendingReview}
              className="flex-1 flex items-center justify-center px-4 py-2 rounded-md bg-[var(--accent-brand)] hover:bg-[var(--accent-brand-hover)] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-40"
            >
              <CheckCircle2 size={14} className="mr-1.5" />
              {syncingRecovery ? 'Checking Gateway...' : eventDetail?.status === 'recovered' ? 'Recovered' : isPendingReview ? 'Approval Required' : 'Check Settlement Signal'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
