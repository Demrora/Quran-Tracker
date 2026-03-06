import { useState } from 'react'
import { getEntreesDeHizb, calculerPourcentage } from '../mapping'

function arcPath(cx, cy, r, startAngle, endAngle) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const x1 = cx + r * Math.cos(toRad(startAngle))
  const y1 = cy + r * Math.sin(toRad(startAngle))
  const x2 = cx + r * Math.cos(toRad(endAngle))
  const y2 = cy + r * Math.sin(toRad(endAngle))
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
}

function couleurArc(pct) {
  if (pct === 0)  return 'rgba(255,255,255,0.06)'
  if (pct < 34)  return 'rgba(26,92,46,0.4)'
  if (pct < 67)  return 'rgba(45,138,78,0.6)'
  if (pct < 100) return 'rgba(61,184,106,0.75)'
  return '#3db86a'
}

export default function CarteCoran({ corpus, version = 'warsh' }) {
  const [hizbSurvole, setHizbSurvole] = useState(null)

  const cx = 150
  const cy = 150
  const rOuter = 130
  const rInner = 85
  const total = 60
  const gap = 1.5
  const sliceAngle = 360 / total

  const pctGlobal = corpus.length > 0
    ? Math.round((new Set(corpus.map(c => c.page)).size / 604) * 100)
    : 0

  const pctSurvole = hizbSurvole
    ? calculerPourcentage(getEntreesDeHizb(hizbSurvole, version), corpus)
    : null

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px',
      marginBottom: '24px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(201,168,76,0.18)',
      borderRadius: '20px',
      backdropFilter: 'blur(16px)'
    }}>
      <div style={{
        fontSize: '10px', fontWeight: 700, letterSpacing: '3px',
        textTransform: 'uppercase', color: 'var(--gold)',
        marginBottom: '16px', alignSelf: 'flex-start'
      }}>
        Carte du Coran
      </div>

      <svg width="300" height="300" viewBox="0 0 300 300">
        {Array.from({ length: total }, (_, i) => {
          const hizbNum = i + 1
          const startAngle = i * sliceAngle - 90 + gap / 2
          const endAngle = (i + 1) * sliceAngle - 90 - gap / 2
          const entrees = getEntreesDeHizb(hizbNum, version)
          const pct = calculerPourcentage(entrees, corpus)
          const survole = hizbSurvole === hizbNum
          const strokeWidth = survole ? (rOuter - rInner + 6) : (rOuter - rInner)
          const rayon = survole ? rOuter + 4 : rOuter

          return (
            <g
              key={hizbNum}
              onMouseEnter={() => setHizbSurvole(hizbNum)}
              onMouseLeave={() => setHizbSurvole(null)}
              style={{ cursor: 'pointer' }}
            >
              <path
                d={arcPath(cx, cy, rayon, startAngle, endAngle)}
                fill="none"
                stroke={couleurArc(pct)}
                strokeWidth={strokeWidth}
                strokeLinecap="butt"
                style={{ transition: 'all 0.2s' }}
              />
            </g>
          )
        })}

        <circle cx={cx} cy={cy} r={rInner - 4} fill="rgba(7,26,14,0.9)" />

        {hizbSurvole ? (
          <g>
            <text x={cx} y={cy - 6} textAnchor="middle"
              fill="rgba(240,235,224,0.5)" fontSize="11"
              fontFamily="Plus Jakarta Sans, sans-serif">
              Hizb
            </text>
            <text x={cx} y={cy + 20} textAnchor="middle"
              fill="var(--gold)" fontSize="32" fontWeight="800"
              fontFamily="Plus Jakarta Sans, sans-serif">
              {hizbSurvole}
            </text>
            <text x={cx} y={cy + 38} textAnchor="middle"
              fill="#3db86a" fontSize="12" fontWeight="600"
              fontFamily="Plus Jakarta Sans, sans-serif">
              {pctSurvole}%
            </text>
          </g>
        ) : (
          <g>
            <text x={cx} y={cy - 8} textAnchor="middle"
              fill="rgba(240,235,224,0.45)" fontSize="11"
              fontFamily="Plus Jakarta Sans, sans-serif">
              memorise
            </text>
            <text x={cx} y={cy + 18} textAnchor="middle"
              fill="var(--gold)" fontSize="32" fontWeight="800"
              fontFamily="Plus Jakarta Sans, sans-serif">
              {pctGlobal}%
            </text>
          </g>
        )}
      </svg>

      <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
        {[
          { color: 'rgba(255,255,255,0.06)', label: 'Non memorise' },
          { color: 'rgba(45,138,78,0.6)', label: 'Partiel' },
          { color: '#3db86a', label: 'Memorise' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: color }} />
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}