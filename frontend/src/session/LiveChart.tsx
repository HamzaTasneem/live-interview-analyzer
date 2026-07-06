// Scrolling neon area chart for a live 0-1 signal (nervousness).
// Pure SVG — no chart dependency, styled like a monitoring dashboard.

const W = 300
const H = 90
const WINDOW = 90 // seconds shown

export default function LiveChart({
  title,
  values,
  color = '#f26d6d',
}: {
  title: string
  values: number[]
  color?: string
}) {
  const shown = values.slice(-WINDOW)
  const current = shown.length ? shown[shown.length - 1] : 0
  const pct = Math.round(current * 100)

  const points = shown.map((v, i) => {
    const x = shown.length > 1 ? (i / (WINDOW - 1)) * W : 0
    const y = H - v * (H - 8) - 4
    return [x, y] as const
  })
  const line = points.map(([x, y]) => `${x},${y}`).join(' ')
  const lastX = points.length ? points[points.length - 1][0] : 0
  const area = points.length
    ? `${line} ${lastX},${H} 0,${H}`
    : ''

  const level = pct >= 66 ? 'high' : pct >= 33 ? 'elevated' : 'low'

  return (
    <div className="live-chart">
      <div className="live-chart-head">
        <span>{title}</span>
        <span className="live-chart-value" style={{ color }}>
          {pct}
          <span className="live-chart-unit">% · {level}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
          <filter id="lc-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* grid */}
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1="0"
            x2={W}
            y1={H - g * (H - 8) - 4}
            y2={H - g * (H - 8) - 4}
            stroke="rgba(147,161,189,0.15)"
            strokeDasharray="4 6"
            strokeWidth="1"
          />
        ))}
        {area && <polygon points={area} fill="url(#lc-fill)" />}
        {points.length > 1 && (
          <polyline
            points={line}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            filter="url(#lc-glow)"
          />
        )}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1][0]}
            cy={points[points.length - 1][1]}
            r="3.5"
            fill={color}
            filter="url(#lc-glow)"
          >
            <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
      <div className="live-chart-foot muted">last {WINDOW}s</div>
    </div>
  )
}
