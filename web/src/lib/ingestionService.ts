/**
 * Ingestion service — parses, maps, and validates order rows from CSV or XLSX.
 *
 * Design principles:
 * - Does NOT assume fixed column names. Every expected field has an alias list.
 * - Year + month are the canonical time fields. A full date column is also
 *   accepted and will be decomposed into year + month.
 * - market_id can come from the file or from a user selection passed at runtime.
 * - Validation is strict: bad rows are reported with clear error messages, not silently dropped.
 */

import Papa from 'papaparse'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedOrderRow {
  customer_name?: string
  grade_name?: string
  market_name?: string
  customer_id?: number
  grade_id?: number
  market_id?: number
  year?: number
  month?: number
  volume?: number
  list_price?: number
  net_price?: number
  rebates?: number
  discounts?: number
}

export interface ColumnMap {
  customer_name?: string
  grade_name?: string
  market?: string
  year?: string
  month?: string
  date?: string
  volume?: string
  net_price?: string
  list_price?: string
  rebates?: string
  discounts?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface ParseResult {
  headers: string[]
  normalisedHeaders: string[]   // for debug panel
  columnMap: ColumnMap
  rows: ParsedOrderRow[]
  validRows: ParsedOrderRow[]
  invalidRows: { row: ParsedOrderRow; errors: string[] }[]
  warnings: string[]
}

// ── Alias dictionary ──────────────────────────────────────────────────────────
// Matching uses normaliseAlias() on both sides — punctuation-insensitive.

const FIELD_ALIASES: Record<keyof ColumnMap, string[]> = {
  customer_name: [
    'customer name', 'customer', 'client name', 'client',
    'sold to', 'ship to', 'sold to party', 'buyer', 'account name', 'account',
  ],
  grade_name: [
    'grade name', 'grade', 'product', 'product name', 'product code',
    'pulp grade', 'material', 'material description', 'item', 'specification', 'spec',
    'product description', 'article',
  ],
  market: [
    'market', 'market name', 'region', 'country', 'sales region',
    'destination', 'dest', 'territory', 'sales area', 'sales territory',
  ],
  year: [
    'year', 'alloc year', 'order year', 'allocation year', 'period year',
    'yr', 'fiscal year', 'delivery year', 'shipment year',
  ],
  month: [
    'month', 'alloc month', 'order month', 'allocation month', 'period month',
    'mo', 'mes', 'delivery month', 'shipment month', 'billing month', 'invoice month',
  ],
  date: [
    'date', 'order date', 'delivery date', 'ship date', 'shipment date',
    'invoice date', 'billing date', 'period', 'posting date', 'document date',
    'alloc date', 'allocation date',
  ],
  volume: [
    'volume', 'vol', 'qty', 'quantity',
    'order quantity', 'order qty', 'order quantity adt', 'order qty adt',
    'order quantity admt', 'order qty admt', 'order quantity mt', 'order qty mt',
    'sales qty', 'sales quantity',
    'shipment qty', 'shipment quantity', 'allocated volume', 'allocation volume',
    'invoiced quantity', 'invoiced qty', 'delivered qty', 'delivered quantity',
    'tons', 'tonnes', 'ton', 'mt', 'admt', 'adt', 'bdt',
    'metric tons', 'metric tonnes', 'volume admt', 'volume mt', 'volume adt',
    'amount', 'net quantity', 'confirmed quantity', 'confirmed qty',
    'order amount', 'quantity mt', 'qty mt', 'quantity adt', 'qty adt',
  ],
  net_price: [
    'net price', 'net', 'price', 'netprice', 'net usd',
    'price usd', 'net price usd', 'realized price', 'actual price',
    'invoice price', 'sales price', 'unit price', 'effective price',
    'price per ton', 'price per mt', 'net price per mt',
  ],
  list_price: [
    'list price', 'list', 'listprice', 'gross price',
    'base price', 'published price', 'reference price', 'catalog price',
    'standard price', 'official price',
  ],
  rebates: [
    'rebates', 'rebate', 'reb', 'rebate amount', 'total rebate',
  ],
  discounts: [
    'discounts', 'discount', 'disc', 'discount amount', 'total discount',
  ],
}

// ── Header normalisation ──────────────────────────────────────────────────────
// Strips ALL punctuation → single spaces, lowercased.
// "Order_Quantity" → "order quantity"
// "Vol (MT)"       → "vol mt"
// "Alloc-Month"    → "alloc month"

export function normaliseHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[_\-/().,'";:[\]{}|\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Same normalisation applied to alias entries so the dictionary doesn't need
// to enumerate every punctuation variant.
function normaliseAlias(a: string): string {
  return normaliseHeader(a)
}

/**
 * Given the actual headers found in a file, returns a ColumnMap telling which
 * actual column corresponds to each expected field.
 */
export function detectColumnMapping(headers: string[]): ColumnMap {
  const normHeaders = headers.map(normaliseHeader)
  const map: ColumnMap = {}

  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [keyof ColumnMap, string[]][]) {
    for (const alias of aliases) {
      const normAlias = normaliseAlias(alias)
      const idx = normHeaders.indexOf(normAlias)
      if (idx !== -1) {
        map[field] = headers[idx]
        break
      }
    }
  }
  return map
}

// ── Month / Year parsers ──────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

/**
 * Robust month parser.
 * Accepts: integers 1–12, strings "1"/"01"/"1 ", month names "Feb"/"February",
 * partial date strings "Feb-26"/"March 2026", JavaScript Date objects,
 * Excel serial date numbers (large ints → treated as Excel epoch).
 */
function parseMonth(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined

  // JavaScript Date (xlsx may produce these with raw:false)
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : value.getMonth() + 1
  }

  const s = String(value).trim()
  if (s === '') return undefined

  // Numeric
  const n = Number(s)
  if (!isNaN(n) && Number.isFinite(n)) {
    const i = Math.round(n)
    if (i >= 1 && i <= 12) return i
    // Excel serial date (values > 100 cannot be a month number)
    if (i > 100) {
      const d = new Date((i - 25569) * 86400 * 1000)
      if (!isNaN(d.getTime())) return d.getMonth() + 1
    }
    return undefined
  }

  // Try full month name or abbreviation anywhere at start of string
  // handles "Feb", "February", "feb-26", "March 2026", "3/2026" (→ numeric above)
  const lower = s.toLowerCase()
  if (MONTH_NAMES[lower] !== undefined) return MONTH_NAMES[lower]

  // Prefix match: "Feb-26", "March 2026"
  const prefixMatch = lower.match(/^([a-z]+)/)
  if (prefixMatch && MONTH_NAMES[prefixMatch[1]] !== undefined) {
    return MONTH_NAMES[prefixMatch[1]]
  }

  return undefined
}

/**
 * Robust year parser.
 * Accepts: 4-digit integers, strings "2026", "2026 ", Date objects, Excel serials.
 */
function parseYear(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : value.getFullYear()
  }

  const s = String(value).trim()
  if (s === '') return undefined

  const n = Number(s)
  if (!isNaN(n) && Number.isFinite(n)) {
    const i = Math.round(n)
    if (i >= 1900 && i <= 2100) return i
    // Excel serial
    if (i > 2100) {
      const d = new Date((i - 25569) * 86400 * 1000)
      if (!isNaN(d.getTime())) return d.getFullYear()
    }
  }
  return undefined
}

// ── Date decomposition ────────────────────────────────────────────────────────

function extractYearMonth(value: unknown): { year: number; month: number } | null {
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) return { year: value.getFullYear(), month: value.getMonth() + 1 }
    return null
  }
  if (typeof value === 'number') {
    const d = new Date((value - 25569) * 86400 * 1000)
    if (!isNaN(d.getTime())) return { year: d.getFullYear(), month: d.getMonth() + 1 }
    return null
  }
  const s = String(value).trim()
  // YYYY-MM-DD or YYYY/MM/DD
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/]\d{1,2}$/)
  if (iso) return { year: parseInt(iso[1]), month: parseInt(iso[2]) }
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dmy) return { year: parseInt(dmy[3]), month: parseInt(dmy[2]) }
  // MM/YYYY or MM-YYYY
  const my = s.match(/^(\d{1,2})[-/](\d{4})$/)
  if (my) return { year: parseInt(my[2]), month: parseInt(my[1]) }
  // YYYY-MM
  const ym = s.match(/^(\d{4})[-/](\d{1,2})$/)
  if (ym) return { year: parseInt(ym[1]), month: parseInt(ym[2]) }
  return null
}

function parseNum(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined
  if (value instanceof Date) return undefined
  const s = String(value).replace(/[$,\s]/g, '').trim()
  if (s === '') return undefined
  const n = parseFloat(s)
  return isNaN(n) ? undefined : n
}

// ── Row normalisation ─────────────────────────────────────────────────────────

export function normaliseRow(
  raw: Record<string, unknown>,
  columnMap: ColumnMap,
  fallbackMarketId?: number,
): ParsedOrderRow {
  const get = (field: keyof ColumnMap): unknown => {
    const col = columnMap[field]
    return col !== undefined ? raw[col] : undefined
  }

  // Time: prefer year+month columns; fall back to date column decomposition
  let year: number | undefined
  let month: number | undefined

  const rawYear  = get('year')
  const rawMonth = get('month')

  if (rawYear  !== undefined) year  = parseYear(rawYear)
  if (rawMonth !== undefined) month = parseMonth(rawMonth)

  if ((year === undefined || month === undefined) && columnMap.date) {
    const ym = extractYearMonth(raw[columnMap.date])
    if (ym) {
      if (year  === undefined) year  = ym.year
      if (month === undefined) month = ym.month
    }
  }

  // Market
  const marketRaw  = get('market')
  const market_name = marketRaw && String(marketRaw).trim() ? String(marketRaw).trim() : undefined
  const market_id   = market_name === undefined ? fallbackMarketId : undefined

  return {
    customer_name: get('customer_name') ? String(get('customer_name')).trim() || undefined : undefined,
    grade_name:    get('grade_name')    ? String(get('grade_name')).trim()    || undefined : undefined,
    market_name,
    market_id,
    year,
    month,
    volume:     parseNum(get('volume')),
    net_price:  parseNum(get('net_price')),
    list_price: parseNum(get('list_price')),
    rebates:    parseNum(get('rebates'))   ?? 0,
    discounts:  parseNum(get('discounts')) ?? 0,
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_YEAR_MIN = 2015
const VALID_YEAR_MAX = 2035

export function validateOrderRow(row: ParsedOrderRow): ValidationResult {
  const errors:   string[] = []
  const warnings: string[] = []

  if (row.year === undefined || row.year === null) {
    errors.push('Year is required')
  } else if (row.year < VALID_YEAR_MIN || row.year > VALID_YEAR_MAX) {
    errors.push(`Year ${row.year} out of range (${VALID_YEAR_MIN}–${VALID_YEAR_MAX})`)
  }

  if (row.month === undefined || row.month === null) {
    errors.push('Month is required')
  } else if (row.month < 1 || row.month > 12) {
    errors.push(`Month ${row.month} invalid — must be 1–12`)
  }

  if (row.volume === undefined) {
    errors.push('Volume is required')
  } else if (row.volume <= 0) {
    errors.push(`Volume must be > 0, got ${row.volume}`)
  } else if (row.volume > 500_000) {
    errors.push(`Volume ${row.volume.toLocaleString()} exceeds 500,000 t — check units`)
  }

  if (row.net_price === undefined) {
    errors.push('Net price is required')
  } else if (row.net_price <= 0) {
    errors.push(`Net price must be > 0, got ${row.net_price}`)
  } else if (row.net_price > 10_000) {
    errors.push(`Net price $${row.net_price} seems unrealistic — check units (USD/ton)`)
  }

  if (row.list_price !== undefined && row.net_price !== undefined) {
    if (row.net_price > row.list_price * 1.1) {
      errors.push(`Net price $${row.net_price} is >10% above list price $${row.list_price}`)
    }
  }

  if (!row.customer_name && !row.customer_id) {
    warnings.push('No customer — will be assigned to market as anonymous')
  }
  if (!row.grade_name && !row.grade_id) {
    warnings.push('No grade — will default to first grade')
  }
  if (!row.market_name && !row.market_id) {
    warnings.push('No market — upload will be rejected unless market selected')
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ── CSV parser ────────────────────────────────────────────────────────────────

export function parseCSVText(csvText: string): { rows: Record<string, unknown>[]; headers: string[] } {
  const result = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })
  const headers = result.meta.fields ?? []
  return { rows: result.data, headers }
}

// ── Full pipeline ─────────────────────────────────────────────────────────────

/**
 * @param columnMapOverride  User-supplied overrides that win over auto-detection.
 *                           Only truthy values override; undefined/empty strings ignored.
 */
export function processRows(
  rawRows: Record<string, unknown>[],
  headers: string[],
  fallbackMarketId?: number,
  columnMapOverride?: Partial<ColumnMap>,
): ParseResult {
  const detected  = detectColumnMapping(headers)
  // Merge: override wins over detected, but only for keys with a real value
  const columnMap: ColumnMap = { ...detected }
  if (columnMapOverride) {
    for (const [k, v] of Object.entries(columnMapOverride)) {
      if (v) (columnMap as Record<string, string>)[k] = v
    }
  }

  const normalisedHeaders = headers.map(normaliseHeader)
  const warnings:   string[] = []
  const validRows:   ParsedOrderRow[] = []
  const invalidRows: { row: ParsedOrderRow; errors: string[] }[] = []
  const rows: ParsedOrderRow[] = []

  for (const raw of rawRows) {
    const row = normaliseRow(raw, columnMap, fallbackMarketId)
    rows.push(row)
    const { valid, errors, warnings: rowWarnings } = validateOrderRow(row)
    warnings.push(...rowWarnings)
    if (valid) {
      validRows.push(row)
    } else {
      invalidRows.push({ row, errors })
    }
  }

  return {
    headers,
    normalisedHeaders,
    columnMap,
    rows,
    validRows,
    invalidRows,
    warnings: [...new Set(warnings)],
  }
}

// ── Helpers for display ───────────────────────────────────────────────────────

export const FIELD_LABELS: Record<keyof ColumnMap, { label: string; required: boolean }> = {
  customer_name: { label: 'Customer Name',  required: false },
  grade_name:    { label: 'Grade / Product', required: false },
  market:        { label: 'Market',          required: false },
  year:          { label: 'Alloc Year',      required: true  },
  month:         { label: 'Alloc Month',     required: true  },
  date:          { label: 'Date (alt.)',      required: false },
  volume:        { label: 'Volume',          required: true  },
  net_price:     { label: 'Net Price',       required: true  },
  list_price:    { label: 'List Price',      required: false },
  rebates:       { label: 'Rebates',         required: false },
  discounts:     { label: 'Discounts',       required: false },
}

export function toOrderDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}
