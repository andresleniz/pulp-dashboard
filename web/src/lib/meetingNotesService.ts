const BULLISH_KEYWORDS = [
  'strong demand',
  'price acceptance',
  'tight supply',
  'increasing orders',
  'capacity constraint',
  'price increase accepted',
  'higher volume',
  'growing demand',
  'positive outlook',
  'willing to increase',
  'destocking complete',
  'returning to normal',
  'volume increase',
  'accepted without',
  'no pushback',
]

const BEARISH_KEYWORDS = [
  'price resistance',
  'weak demand',
  'high inventory',
  'pushback',
  'no room',
  'reducing volume',
  'competitive pressure',
  'volume decline',
  'discount pressure',
  'surplus',
  'oversupply',
  'structural decline',
  'reducing orders',
  'below budget',
  'difficult market',
]

const PRICE_PATTERN = /\$\d{3,4}(?:\.\d{1,2})?|\d{3,4}\s*(?:usd|USD)\/ton/g
const COMPETITOR_NAMES = [
  'suzano', 'cmpc', 'fibria', 'app', 'mercer', 'resolute', 'upm',
  'sappi', 'stora enso', 'domtar', 'nippon', 'oji', 'april', 'arauco',
  'eldorado', 'canfor', 'west fraser',
]

export function processMeetingNote(rawText: string, tags: string[]): {
  sentiment: 'bullish' | 'neutral' | 'bearish'
  extractedSignals: string[]
} {
  const lower = rawText.toLowerCase()
  const signals: string[] = []

  let bullishCount = 0
  let bearishCount = 0

  for (const kw of BULLISH_KEYWORDS) {
    if (lower.includes(kw)) bullishCount++
  }
  for (const kw of BEARISH_KEYWORDS) {
    if (lower.includes(kw)) bearishCount++
  }

  // Signal: competitor mention
  for (const name of COMPETITOR_NAMES) {
    if (lower.includes(name)) {
      signals.push('competitor_mention')
      break
    }
  }

  // Signal: price numbers mentioned
  PRICE_PATTERN.lastIndex = 0
  if (PRICE_PATTERN.test(rawText)) {
    signals.push('price_mention')
  }

  // Signal: demand shift
  if (
    lower.includes('demand') &&
    (lower.includes('increas') || lower.includes('decreas') || lower.includes('shift') || lower.includes('grow'))
  ) {
    signals.push('demand_shift')
  }

  // Signal: price resistance
  if (
    lower.includes('price resistance') ||
    lower.includes('pushback') ||
    lower.includes('no room') ||
    lower.includes('resist') && lower.includes('price')
  ) {
    signals.push('price_resistance')
  }

  // Signal: competitor increasing
  if (
    (lower.includes('competitor') || COMPETITOR_NAMES.some(n => lower.includes(n))) &&
    (lower.includes('increas') || lower.includes('rais') || lower.includes('higher price') || lower.includes('price hike'))
  ) {
    signals.push('competitor_increasing')
  }

  // Signal: tight supply
  if (
    lower.includes('tight supply') ||
    lower.includes('no supply') ||
    lower.includes('supply constraint') ||
    lower.includes('capacity constraint') ||
    lower.includes('curtailment') ||
    lower.includes('outage') ||
    lower.includes('mill closure') ||
    lower.includes('force majeure')
  ) {
    signals.push('tight_supply')
  }

  // Signal: field intelligence contradiction (added to signals so UI can surface it)
  // This flag is determined externally when comparing against model direction,
  // but we add 'model_conflict' if strong contradictory signals are present
  const hasStrongBullish = bullishCount >= 3
  const hasStrongBearish = bearishCount >= 3
  if (hasStrongBullish && bearishCount === 0) signals.push('strong_bullish_field')
  if (hasStrongBearish && bullishCount === 0) signals.push('strong_bearish_field')

  // Add tag-derived signals
  for (const tag of tags) {
    if (tag === 'supply_issue' && !signals.includes('tight_supply')) {
      signals.push('tight_supply')
    }
    if (tag === 'price_pressure' && !signals.includes('price_mention')) {
      signals.push('price_mention')
    }
  }

  // ─── Sentiment determination ───────────────────────────────────────────────
  // Require a net difference of ≥2 for a directional call. A single keyword
  // match is treated as noise (neutral). This prevents over-reaction to
  // incidental word use.
  const diff = bullishCount - bearishCount
  let sentiment: 'bullish' | 'neutral' | 'bearish'
  if (diff >= 2) sentiment = 'bullish'
  else if (diff <= -2) sentiment = 'bearish'
  else sentiment = 'neutral'

  return {
    sentiment,
    extractedSignals: [...new Set(signals)],
  }
}
