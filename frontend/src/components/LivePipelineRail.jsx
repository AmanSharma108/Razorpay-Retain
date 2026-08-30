import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function LivePipelineRail({ activeStage = 3, pendingCount = 0 }) {
  const [hoveredStage, setHoveredStage] = useState(null);

  const stages = [
    {
      id: 1,
      num: '01',
      name: 'Ingestion',
      sub: 'Dual-Path (HMAC + Polling)',
      detail: 'Real-time webhook signature verification and background fallback queue polling Razorpay APIs.'
    },
    {
      id: 2,
      num: '02',
      name: 'Diagnosis',
      sub: 'Root Cause & Severity',
      detail: 'Verbatim error code extraction (insufficient_funds, issuer_decline, 3DS timeout) with confidence rating.'
    },
    {
      id: 3,
      num: '03',
      name: 'Policy Bandit',
      sub: 'Thompson Sampling Beta(α, β)',
      detail: 'Bayesian multi-armed bandit dynamically selects highest-converting recovery rails per failure archetype.'
    },
    {
      id: 4,
      num: '04',
      name: 'Review Gate',
      sub: pendingCount > 0 ? `${pendingCount} Pending HITL` : 'HITL Safety Gate',
      badge: pendingCount > 0 ? pendingCount : null,
      detail: 'Guards high-value transactions (>₹10k) and discount concessions behind operator verification.'
    },
    {
      id: 5,
      num: '05',
      name: 'Execution',
      sub: 'Smart Link Dispatch',
      detail: 'Generates live Razorpay Payment Links (rzp.io) and triggers contextual customer reminders.'
    },
    {
      id: 6,
      num: '06',
      name: 'Verification',
      sub: 'Posterior Update',
      detail: 'Settlement webhook signal verifies recovery and updates bandit reward posterior (α ← α + 1).'
    }
  ];

  return (
    <div className="w-full bg-[var(--surface-card)] border-b border-[var(--border-subtle)] px-6 py-2.5 shadow-sm select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        {/* Rail Label */}
        <div className="hidden lg:flex items-center space-x-2 shrink-0 pr-4 border-r border-[var(--border-subtle)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-brand)] animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--ink-muted)] font-semibold">
            Live Rail
          </span>
        </div>

        {/* 6 Stage Nodes with Connecting Rails */}
        <div className="flex-1 flex items-center justify-between min-w-[700px]">
          {stages.map((st, idx) => {
            const isActive = st.id === activeStage || (st.id === 4 && pendingCount > 0);
            const isCompleted = st.id < activeStage;
            const isHovered = hoveredStage === st.id;

            return (
              <React.Fragment key={st.id}>
                {/* Node Item */}
                <div
                  onMouseEnter={() => setHoveredStage(st.id)}
                  onMouseLeave={() => setHoveredStage(null)}
                  className="relative flex items-center space-x-2 group cursor-pointer"
                >
                  {/* Node Dot / Circle */}
                  <div className="relative flex items-center justify-center shrink-0">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                        isActive
                          ? 'bg-[var(--accent-brand)] text-white pipeline-node-active shadow-sm'
                          : isCompleted
                          ? 'bg-[var(--surface-card-subtle)] border border-[var(--accent-brand)] text-[var(--accent-brand)]'
                          : 'bg-[var(--surface-card-subtle)] border border-[var(--border-strong)] text-[var(--ink-muted)]'
                      }`}
                    >
                      {st.badge ? (
                        <span className="text-[9px] font-bold text-white">{st.badge}</span>
                      ) : (
                        <span>{st.num}</span>
                      )}
                    </div>
                  </div>

                  {/* Node Label & Subtitle */}
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`text-xs font-semibold tracking-tight transition-colors ${
                          isActive
                            ? 'text-[var(--accent-brand)] font-bold'
                            : 'text-[var(--ink-primary)] group-hover:text-[var(--accent-brand)]'
                        }`}
                      >
                        {st.name}
                      </span>
                      {st.badge && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)] animate-pulse" />
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--ink-muted)] font-mono truncate max-w-[110px]">
                      {st.sub}
                    </span>
                  </div>

                  {/* Tooltip on Hover */}
                  {isHovered && (
                    <div className="absolute top-full mt-2 left-0 z-50 w-64 p-2.5 rounded-md bg-[var(--surface-card)] border border-[var(--border-strong)] shadow-lg text-xs space-y-1 pointer-events-none">
                      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1">
                        <span className="font-bold text-[var(--ink-primary)]">
                          Stage {st.num}: {st.name}
                        </span>
                        <span className="text-[9px] font-mono text-[var(--accent-brand)] uppercase font-semibold">
                          Active Protocol
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed">
                        {st.detail}
                      </p>
                    </div>
                  )}
                </div>

                {/* Connecting Rail Line */}
                {idx < stages.length - 1 && (
                  <div className="flex-1 h-[1.5px] mx-3 bg-[var(--border-subtle)] relative overflow-hidden shrink-0">
                    {/* Active flow signal line */}
                    {isCompleted && (
                      <div className="absolute inset-0 bg-[var(--accent-brand)] opacity-60" />
                    )}
                    {isActive && (
                      <div className="absolute inset-0 bg-[var(--accent-brand)] opacity-40" />
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
