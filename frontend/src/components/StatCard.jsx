import React from 'react';

export default function StatCard({ title, value, icon, color = 'green', subtitle, trend, onClick }) {
  const colorMap = {
    red: 'text-[var(--status-error)]',
    amber: 'text-[var(--status-warning)]',
    green: 'text-[var(--status-success)]',
    blue: 'text-[var(--accent-brand)]',
  };

  const valColor = colorMap[color] || 'text-[var(--ink-primary)]';

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:border-[var(--border-strong)] transition-all ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1.5 flex-1">
          {/* Quiet, low-contrast small label */}
          <span className="text-[11px] font-medium tracking-wider uppercase text-[var(--ink-muted)] block">
            {title}
          </span>

          {/* Bold, prominent tabular numeric value with visual hierarchy dominance */}
          <div className={`text-2xl font-bold font-mono tracking-tight leading-none ${valColor}`}>
            {value}
          </div>

          {subtitle && (
            <p className="text-[11px] text-[var(--ink-muted)] pt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        <div className="text-[var(--ink-muted)] p-1.5 rounded-md bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] shrink-0 ml-2">
          {icon}
        </div>
      </div>

      {trend && (
        <div className="mt-2.5 pt-2 border-t border-[var(--border-subtle)] text-[10px] font-mono flex items-center justify-between text-[var(--ink-muted)]">
          <span className="font-semibold text-[var(--status-success)] flex items-center">
            {trend}
          </span>
          <span className="text-[var(--ink-tertiary)]">vs baseline</span>
        </div>
      )}
    </div>
  );
}
