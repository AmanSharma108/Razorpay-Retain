import React from 'react';
import { Cpu } from 'lucide-react';

function logGamma(z) {
  const g = 7;
  const C = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109583654526,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];

  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let base = C[0];
  for (let i = 1; i < g + 2; i++) base += C[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(base);
}

function betaPDF(x, alpha, beta) {
  if (x <= 0 || x >= 1) return 0;
  const logBeta = logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
  const logVal = (alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - logBeta;
  return Math.exp(logVal);
}

export default function BanditCurves({ stats = [] }) {
  const width = 640;
  const height = 180;
  const padding = { top: 20, right: 30, bottom: 30, left: 30 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const colorMap = {
    send_retry_link: '#3395FF',
    send_reminder_email: '#F5A623',
    offer_alternate_method: '#0F9D58',
    auto_retry_payment: '#3395FF',
    send_invoice_reminder: '#F5A623',
    escalate_to_support: '#E5484D',
    apply_discount: '#0F9D58',
  };

  const numPoints = 80;
  const xValues = Array.from({ length: numPoints }, (_, i) => 0.02 + (i / (numPoints - 1)) * 0.96);

  let maxDensity = 1.0;
  const armCurves = stats.map(stat => {
    const alpha = Math.max(1, stat.alpha || 1);
    const beta = Math.max(1, stat.beta_param || 1);
    const color = colorMap[stat.action_type] || '#3395FF';

    const points = xValues.map(x => {
      const y = betaPDF(x, alpha, beta);
      if (y > maxDensity) maxDensity = y;
      return { x, y };
    });

    const expectedMean = (alpha / (alpha + beta));

    return {
      name: stat.action_type,
      eventType: stat.event_type,
      alpha,
      beta,
      color,
      points,
      expectedMean,
      attempts: stat.total_attempts,
      successes: stat.total_successes
    };
  });

  const yMax = Math.min(Math.max(maxDensity, 3.5), 15);

  const getSvgPath = (points) => {
    return points.reduce((path, pt, i) => {
      const px = padding.left + pt.x * plotWidth;
      const clampedY = Math.min(pt.y, yMax);
      const py = padding.top + plotHeight - (clampedY / yMax) * plotHeight;
      return `${path} ${i === 0 ? 'M' : 'L'} ${px.toFixed(1)},${py.toFixed(1)}`;
    }, '');
  };

  const getAreaPath = (points) => {
    const linePath = getSvgPath(points);
    const startX = padding.left + points[0].x * plotWidth;
    const endX = padding.left + points[points.length - 1].x * plotWidth;
    const baseY = padding.top + plotHeight;
    return `${linePath} L ${endX.toFixed(1)},${baseY} L ${startX.toFixed(1)},${baseY} Z`;
  };

  return (
    <div className="p-5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-4 shadow-[var(--shadow-card)] relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[var(--ink-primary)] flex items-center">
              <Cpu size={14} className="text-[var(--accent-brand)] mr-1.5" />
              Bayesian Posterior Probability Curves <code className="text-xs text-[var(--accent-brand)] font-mono ml-2 font-bold">Beta(α, β)</code>
            </h3>
          </div>
          <p className="text-xs text-[var(--ink-muted)] mt-0.5">
            Narrow bell curves indicate empirical confidence. Wider curves denote active exploration.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono text-[var(--ink-muted)] bg-[var(--surface-card-subtle)] px-2.5 py-1 rounded border border-[var(--border-subtle)]">
          <span>Sampling:</span>
          <span className="text-[var(--accent-brand)] font-bold">θ_k ~ Beta(α_k, β_k)</span>
        </div>
      </div>

      {/* SVG Canvas for Beta Curves */}
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 select-none">
          <defs>
            {armCurves.map((arm, i) => (
              <linearGradient key={`grad-${i}`} id={`bandit-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={arm.color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={arm.color} stopOpacity={0.0} />
              </linearGradient>
            ))}
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((tick, i) => {
            const x = padding.left + tick * plotWidth;
            return (
              <g key={`grid-x-${i}`}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={padding.top + plotHeight}
                  stroke="var(--border-subtle)"
                  strokeDasharray="4 4"
                />
                <text
                  x={x}
                  y={height - 10}
                  textAnchor="middle"
                  fill="var(--ink-muted)"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                >
                  {(tick * 100).toFixed(0)}%
                </text>
              </g>
            );
          })}

          {/* X Axis base line */}
          <line
            x1={padding.left}
            y1={padding.top + plotHeight}
            x2={width - padding.right}
            y2={padding.top + plotHeight}
            stroke="var(--border-strong)"
            strokeWidth="1.5"
          />

          {/* Render each Arm Area & Line */}
          {armCurves.map((arm, idx) => (
            <g key={`arm-group-${idx}`}>
              <path
                d={getAreaPath(arm.points)}
                fill={`url(#bandit-grad-${idx})`}
              />
              <path
                d={getSvgPath(arm.points)}
                fill="none"
                stroke={arm.color}
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Expected Value Marker */}
              <line
                x1={padding.left + arm.expectedMean * plotWidth}
                y1={padding.top}
                x2={padding.left + arm.expectedMean * plotWidth}
                y2={padding.top + plotHeight}
                stroke={arm.color}
                strokeWidth="1.5"
                strokeDasharray="2 2"
                opacity={0.8}
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Arm Badges Legend */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-subtle)]">
        {armCurves.map((arm, i) => (
          <div
            key={i}
            className="flex items-center space-x-2 px-2.5 py-1 rounded bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] text-xs font-mono"
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: arm.color }} />
            <span className="font-semibold text-[var(--ink-primary)]">{arm.name}</span>
            <span className="text-[10px] text-[var(--ink-muted)]">
              Mean: <b className="text-[var(--status-success)] tabular-nums">{(arm.expectedMean * 100).toFixed(0)}%</b> (α={arm.alpha}, β={arm.beta})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
