/**
 * Standalone ingestion test — runs the same logic as ingestionService.ts
 * without TypeScript/path-alias dependencies.
 *
 * Usage:  node scripts/test-ingest.mjs <path-to-file.xlsx>
 */

import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'

const require = createRequire(import.meta.url)
const XLSX    = require('xlsx')

const filePath = process.argv[2]
if (!filePath) { console.error('Usage: node scripts/test-ingest.mjs <file>'); process.exit(1) }

// ── Load file ─────────────────────────────────────────────────────────────────
const buf = readFileSync(filePath)
const wb  = XLSX.read(buf, { type: 'buffer', cellDates: true })
const ws  = wb.Sheets[wb.SheetNames[0]]
const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true })
const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : []

console.log('\n════════════════════════════════════════')
console.log('  INGESTION DEBUG REPORT')
console.log(`  File: ${path.basename(filePath)}`)
console.log(`  Sheet: ${wb.SheetNames[0]}   Rows: ${rawRows.length}`)
console.log('════════════════════════════════════════\n')

// ── Normalise header ──────────────────────────────────────────────────────────
function normaliseHeader(h) {
  return h.trim().toLowerCase()
    .replace(/[_\-/().,'";:[\]{}|\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

console.log('── 1. RAW HEADERS ──────────────────────')
headers.forEach((h, i) => {
  console.log(`  [${String(i+1).padStart(2)}] "${h}"  →  "${normaliseHeader(h)}"`)
})
console.log()

// ── Alias dictionary (mirrors ingestionService.ts) ────────────────────────────
const ALIASES = {
  customer_name: ['customer name','customer','client name','client','sold to','ship to','sold to party','buyer','account name','account'],
  grade_name:    ['grade name','grade','product','product name','product code','pulp grade','material','material description','item','specification','spec','product description','article'],
  market:        ['market','market name','region','country','sales region','destination','dest','territory','sales area','sales territory'],
  year:          ['year','alloc year','order year','allocation year','period year','yr','fiscal year','delivery year','shipment year'],
  month:         ['month','alloc month','order month','allocation month','period month','mo','mes','delivery month','shipment month','billing month','invoice month'],
  date:          ['date','order date','delivery date','ship date','shipment date','invoice date','billing date','period','posting date','document date','alloc date','allocation date'],
  volume:        ['volume','vol','qty','quantity','order quantity','order qty','order quantity adt','order qty adt','order quantity admt','order qty admt','order quantity mt','order qty mt','sales qty','sales quantity','shipment qty','shipment quantity','allocated volume','allocation volume','invoiced quantity','invoiced qty','delivered qty','delivered quantity','tons','tonnes','ton','mt','admt','adt','bdt','metric tons','metric tonnes','volume admt','volume mt','volume adt','amount','net quantity','confirmed quantity','confirmed qty','order amount','quantity mt','qty mt','quantity adt','qty adt'],
  net_price:     ['net price','net','price','netprice','net usd','price usd','net price usd','realized price','actual price','invoice price','sales price','unit price','effective price','price per ton','price per mt','net price per mt'],
  list_price:    ['list price','list','listprice','gross price','base price','published price','reference price','catalog price','standard price','official price'],
  rebates:       ['rebates','rebate','reb','rebate amount','total rebate'],
  discounts:     ['discounts','discount','disc','discount amount','total discount'],
}

// ── Detect mapping ─────────────────────────────────────────────────────────────
const normHeaders = headers.map(normaliseHeader)
const columnMap = {}
for (const [field, aliases] of Object.entries(ALIASES)) {
  for (const alias of aliases) {
    const normAlias = normaliseHeader(alias)
    const idx = normHeaders.indexOf(normAlias)
    if (idx !== -1) { columnMap[field] = headers[idx]; break }
  }
}

console.log('── 2. AUTO-DETECTED FIELD MAPPING ──────')
const REQUIRED = ['year','month','volume','net_price']
for (const [field, aliases] of Object.entries(ALIASES)) {
  const col = columnMap[field]
  const req = REQUIRED.includes(field) ? ' *REQUIRED*' : ''
  if (col) {
    console.log(`  ✓ ${field.padEnd(14)} → "${col}"${req}`)
  } else {
    console.log(`  ✗ ${field.padEnd(14)} → NOT DETECTED${req}`)
  }
}
console.log()

// ── Month/Year parsers ─────────────────────────────────────────────────────────
const MONTH_NAMES = {
  january:1,february:2,march:3,april:4,may:5,june:6,
  july:7,august:8,september:9,october:10,november:11,december:12,
  jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,
  sep:9,sept:9,oct:10,nov:11,dec:12,
}

function parseMonth(value) {
  if (value == null) return undefined
  if (value instanceof Date) return isNaN(value) ? undefined : value.getMonth() + 1
  const s = String(value).trim()
  if (s === '') return undefined
  const n = Number(s)
  if (!isNaN(n) && isFinite(n)) {
    const i = Math.round(n)
    if (i >= 1 && i <= 12) return i
    if (i > 100) { const d = new Date((i - 25569) * 86400 * 1000); if (!isNaN(d)) return d.getMonth()+1 }
    return undefined
  }
  const lower = s.toLowerCase()
  if (MONTH_NAMES[lower] !== undefined) return MONTH_NAMES[lower]
  const prefix = lower.match(/^([a-z]+)/)
  if (prefix && MONTH_NAMES[prefix[1]] !== undefined) return MONTH_NAMES[prefix[1]]
  return undefined
}

function parseYear(value) {
  if (value == null) return undefined
  if (value instanceof Date) return isNaN(value) ? undefined : value.getFullYear()
  const s = String(value).trim()
  if (s === '') return undefined
  const n = Number(s)
  if (!isNaN(n) && isFinite(n)) {
    const i = Math.round(n)
    if (i >= 1900 && i <= 2100) return i
    if (i > 2100) { const d = new Date((i - 25569) * 86400 * 1000); if (!isNaN(d)) return d.getFullYear() }
  }
  return undefined
}

function parseNum(value) {
  if (value == null) return undefined
  if (value instanceof Date) return undefined
  const s = String(value).replace(/[$,\s]/g, '').trim()
  if (s === '') return undefined
  const n = parseFloat(s)
  return isNaN(n) ? undefined : n
}

// ── Diagnose first 5 raw month/volume values ──────────────────────────────────
console.log('── 3. RAW VALUE SAMPLE (first 5 rows) ──')
const monthCol  = columnMap.month
const yearCol   = columnMap.year
const volumeCol = columnMap.volume
const priceCol  = columnMap.net_price

for (let i = 0; i < Math.min(5, rawRows.length); i++) {
  const r = rawRows[i]
  const rawM = monthCol  ? r[monthCol]  : '(no col)'
  const rawY = yearCol   ? r[yearCol]   : '(no col)'
  const rawV = volumeCol ? r[volumeCol] : '(no col)'
  const rawP = priceCol  ? r[priceCol]  : '(no col)'
  const parsedM = monthCol  ? parseMonth(rawM)  : undefined
  const parsedY = yearCol   ? parseYear(rawY)   : undefined
  const parsedV = volumeCol ? parseNum(rawV)    : undefined
  const parsedP = priceCol  ? parseNum(rawP)    : undefined
  console.log(`  Row ${i+1}:`)
  console.log(`    month  raw="${rawM}" (${typeof rawM}) → ${parsedM}`)
  console.log(`    year   raw="${rawY}" (${typeof rawY}) → ${parsedY}`)
  console.log(`    volume raw="${rawV}" (${typeof rawV}) → ${parsedV}`)
  console.log(`    price  raw="${rawP}" (${typeof rawP}) → ${parsedP}`)
}
console.log()

// ── Parse all rows ────────────────────────────────────────────────────────────
function get(raw, field) {
  const col = columnMap[field]
  return col !== undefined ? raw[col] : undefined
}

function extractYearMonth(v) {
  if (v instanceof Date) { if (!isNaN(v)) return { year: v.getFullYear(), month: v.getMonth()+1 }; return null }
  if (typeof v === 'number') { const d = new Date((v-25569)*86400*1000); if (!isNaN(d)) return { year: d.getFullYear(), month: d.getMonth()+1 }; return null }
  const s = String(v).trim()
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/]\d{1,2}$/)
  if (iso) return { year: parseInt(iso[1]), month: parseInt(iso[2]) }
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dmy) return { year: parseInt(dmy[3]), month: parseInt(dmy[2]) }
  const my = s.match(/^(\d{1,2})[-/](\d{4})$/)
  if (my) return { year: parseInt(my[2]), month: parseInt(my[1]) }
  const ym = s.match(/^(\d{4})[-/](\d{1,2})$/)
  if (ym) return { year: parseInt(ym[1]), month: parseInt(ym[2]) }
  return null
}

const parsed = rawRows.map(raw => {
  let year  = parseYear(get(raw,'year'))
  let month = parseMonth(get(raw,'month'))
  if ((year === undefined || month === undefined) && columnMap.date) {
    const ym = extractYearMonth(raw[columnMap.date])
    if (ym) { if (year===undefined) year=ym.year; if (month===undefined) month=ym.month }
  }
  const marketRaw  = get(raw,'market')
  const market_name = marketRaw && String(marketRaw).trim() ? String(marketRaw).trim() : undefined
  return {
    customer_name: get(raw,'customer_name') ? String(get(raw,'customer_name')).trim()||undefined : undefined,
    grade_name:    get(raw,'grade_name')    ? String(get(raw,'grade_name')).trim()   ||undefined : undefined,
    market_name,
    year, month,
    volume:    parseNum(get(raw,'volume')),
    net_price: parseNum(get(raw,'net_price')),
    list_price:parseNum(get(raw,'list_price')),
  }
})

// ── Validate ──────────────────────────────────────────────────────────────────
function validate(row) {
  const errors = []
  if (row.year  == null) errors.push('year missing')
  else if (row.year < 2015 || row.year > 2035) errors.push(`year ${row.year} out of range`)
  if (row.month == null) errors.push('month missing')
  else if (row.month < 1 || row.month > 12) errors.push(`month ${row.month} invalid`)
  if (row.volume == null) errors.push('volume missing')
  else if (row.volume <= 0) errors.push('volume <= 0')
  else if (row.volume > 500000) errors.push('volume > 500k')
  if (row.net_price == null) errors.push('net_price missing')
  else if (row.net_price <= 0) errors.push('net_price <= 0')
  else if (row.net_price > 10000) errors.push('net_price > 10k')
  return errors
}

const validRows   = parsed.filter(r => validate(r).length === 0)
const invalidRows = parsed.map((r,i) => ({ i: i+1, r, errors: validate(r) })).filter(x => x.errors.length > 0)

// ── Error summary ─────────────────────────────────────────────────────────────
console.log('── 4. VALIDATION SUMMARY ───────────────')
console.log(`  Total rows  : ${parsed.length}`)
console.log(`  Valid rows  : ${validRows.length}`)
console.log(`  Invalid rows: ${invalidRows.length}`)
if (invalidRows.length > 0) {
  const errorCounts = {}
  for (const { errors } of invalidRows) for (const e of errors) errorCounts[e] = (errorCounts[e]||0)+1
  console.log('\n  Error breakdown:')
  for (const [e, n] of Object.entries(errorCounts).sort((a,b)=>b[1]-a[1])) {
    console.log(`    ${String(n).padStart(4)}x  ${e}`)
  }
}
console.log()

// ── First 10 parsed rows ──────────────────────────────────────────────────────
console.log('── 5. FIRST 10 PARSED ROWS ─────────────')
const cols = ['customer_name','grade_name','market_name','year','month','volume','net_price']
const widths = [22, 16, 12, 6, 5, 10, 10, 30]
const header = ['Customer','Grade','Market','Year','Mo','Volume','NetPrice','Issues']
  .map((h,i) => h.padEnd(widths[i])).join('  ')
console.log('  ' + header)
console.log('  ' + '-'.repeat(header.length))
for (let i = 0; i < Math.min(10, parsed.length); i++) {
  const r = parsed[i]
  const errors = validate(r)
  const ok = errors.length === 0 ? '✓' : '✗'
  const line = [
    (r.customer_name || '—').slice(0,20).padEnd(widths[0]),
    (r.grade_name    || '—').slice(0,14).padEnd(widths[1]),
    (r.market_name   || '—').slice(0,10).padEnd(widths[2]),
    String(r.year  ?? '—').padEnd(widths[3]),
    String(r.month ?? '—').padEnd(widths[4]),
    String(r.volume ?? '—').padEnd(widths[5]),
    String(r.net_price != null ? r.net_price.toFixed(0) : '—').padEnd(widths[6]),
    errors.join(', '),
  ].join('  ')
  console.log(`  ${ok} ${line}`)
}
console.log()
console.log(`Columns used: volume="${volumeCol||'NOT FOUND'}"  month="${monthCol||'NOT FOUND'}"  year="${yearCol||'NOT FOUND'}"  net_price="${priceCol||'NOT FOUND'}"`)
console.log()
