export interface LiveMeterValues {
  eyeContact: number // rolling % 0-100
  tension: number // 0-1
  fidget: number // 0-1
  wpm: number
  volume: number // 0-1-ish rms
  energy: number // 0-1 composite (F4)
  posture: number | null // 0-1, null until pose model detects (F3)
}

function color(value: number, invert = false) {
  const v = invert ? 1 - value : value
  if (v >= 0.66) return 'var(--good)'
  if (v >= 0.33) return 'var(--warn)'
  return 'var(--bad)'
}

function Meter({
  name,
  display,
  fraction,
  invert = false,
}: {
  name: string
  display: string
  fraction: number
  invert?: boolean
}) {
  const clamped = Math.max(0, Math.min(1, fraction))
  return (
    <div className="meter">
      <div className="label">
        <span>{name}</span>
        <span>{display}</span>
      </div>
      <div className="bar">
        <div
          className="fill"
          style={{ width: `${clamped * 100}%`, background: color(clamped, invert) }}
        />
      </div>
    </div>
  )
}

export default function Meters({ values }: { values: LiveMeterValues }) {
  // WPM meter: 135 is ideal center; map 60-210 onto 0-1 closeness
  const paceCloseness =
    values.wpm === 0 ? 0.5 : Math.max(0, 1 - Math.abs(values.wpm - 135) / 75)
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Live signals</h3>
      <Meter
        name="Eye contact"
        display={`${Math.round(values.eyeContact)}%`}
        fraction={values.eyeContact / 100}
      />
      <Meter
        name="Composure"
        display={values.tension < 0.33 ? 'relaxed' : values.tension < 0.66 ? 'some tension' : 'tense'}
        fraction={1 - values.tension}
      />
      <Meter
        name="Stillness"
        display={values.fidget < 0.33 ? 'steady' : values.fidget < 0.66 ? 'moving' : 'fidgety'}
        fraction={1 - values.fidget}
      />
      <Meter
        name="Pace"
        display={values.wpm > 0 ? `${Math.round(values.wpm)} wpm` : 'listening…'}
        fraction={paceCloseness}
      />
      <Meter
        name="Volume"
        display={values.volume < 0.01 ? 'quiet' : values.volume < 0.05 ? 'ok' : 'strong'}
        fraction={Math.min(1, values.volume * 12)}
      />
      <Meter
        name="Energy"
        display={values.energy < 0.25 ? 'monotone' : values.energy < 0.55 ? 'steady' : 'expressive'}
        fraction={values.energy}
      />
      {values.posture !== null && (
        <Meter
          name="Posture"
          display={values.posture >= 0.66 ? 'upright' : values.posture >= 0.4 ? 'ok' : 'slouched'}
          fraction={values.posture}
        />
      )}
    </div>
  )
}
