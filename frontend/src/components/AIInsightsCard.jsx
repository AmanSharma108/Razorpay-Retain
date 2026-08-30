import React, { useState } from 'react';
import { Cpu, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AIInsightsCard({ summary, onTriggerAutonomousAction }) {
  const [autoPilot, setAutoPilot] = useState(false);

  const insights = [
    {
      id: 1,
      title: 'Cart Abandonment Dynamic Concession',
      recommendation: 'Dynamic 10% discount policy yields an 88.4% win-rate on carts > ₹3,000.',
      impact: '+24.6% Lift',
      tag: 'THOMPSON_BANDIT'
    },
    {
      id: 2,
      title: 'Domestic Card 3DS Auth Fallback',
      recommendation: 'Auto-fallback to UPI Intent reduces checkout dropoffs by 31%.',
      impact: '-31% Friction',
      tag: 'ROUTING_HEURISTIC'
    },
    {
      id: 3,
      title: 'Net-30 Dunning Window Escalation',
      recommendation: 'Invoice reminders dispatched within 4h of expiry achieve 3.4x faster settlement.',
      impact: '3.4x Settlement',
      tag: 'B2B_PROTOCOL'
    }
  ];

  const handleToggleAutoPilot = () => {
    const nextState = !autoPilot;
    setAutoPilot(nextState);
    if (nextState) {
      toast.success('Autonomous Protocol Active');
      if (onTriggerAutonomousAction) onTriggerAutonomousAction();
    } else {
      toast.info('Autonomous Protocol Suspended (Manual HITL Gate)');
    }
  };

  return (
    <div className="p-5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-md bg-[var(--accent-brand-subtle)] text-[var(--accent-brand)] flex items-center justify-center">
            <Cpu size={15} />
          </div>
          <div>
            <h3 className="text-xs font-heading font-bold text-[var(--ink-primary)]">
              Decision Intelligence & Optimization Heuristics
            </h3>
            <p className="text-[11px] text-[var(--ink-muted)]">
              Continuous Bayesian policy recommendations from live Razorpay telemetry
            </p>
          </div>
        </div>

        {/* Auto-Pilot Toggle */}
        <button
          onClick={handleToggleAutoPilot}
          className={`flex items-center space-x-2 px-2.5 py-1 rounded border text-xs font-mono transition-colors ${
            autoPilot
              ? 'bg-[var(--status-success-subtle)] border-[var(--status-success)]/30 text-[var(--status-success)]'
              : 'bg-[var(--surface-card-subtle)] border-[var(--border-subtle)] text-[var(--ink-muted)] hover:border-[var(--border-strong)]'
          }`}
        >
          <span className="text-[10px] uppercase">Auto-Pilot:</span>
          <span className="font-bold">{autoPilot ? 'ACTIVE' : 'STANDBY'}</span>
        </button>
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {insights.map((item) => (
          <div
            key={item.id}
            className="p-3.5 rounded-md bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] space-y-2 hover:border-[var(--border-strong)] transition-colors"
          >
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-[var(--accent-brand)] font-semibold">{item.tag}</span>
              <span className="font-bold text-[var(--status-success)]">{item.impact}</span>
            </div>
            <h4 className="text-xs font-semibold text-[var(--ink-primary)] leading-tight">
              {item.title}
            </h4>
            <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed font-sans">
              {item.recommendation}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
