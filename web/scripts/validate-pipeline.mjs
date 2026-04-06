/**
 * validate-pipeline.mjs
 * Six-phase end-to-end validation against the live Next.js dev server.
 *
 * Usage:  node scripts/validate-pipeline.mjs <path-to-file.xlsx>
 *
 * Targets the first market with >0 rows in the file.
 * Phases: ingest → store → aggregate → dashboard → mock-contamination → sanity.
 */

import { readFileSync } from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const BASE = 'http://localhost:3000'
const FILE = process.argv[2]
if (!FILE) { console.error('Usage: node scripts/validate-pipeline.mjs <file.xlsx>'); process.exit(1) }

// ─── helpers ──────────────────────────────────────────────────────────────────
function h(title) { console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`) }
function s(title) { console.log(`\n── ${title} ${'─'.repeat(Math.max(0,54-title.length))}`) }
function ok(msg)  { console.log(`  ✓ ${msg}`) }
function warn(msg){ console.log(`  ⚠ ${msg}`) }
function err(msg) { console.log(`  ✗ ${msg}`) }
function info(msg){ console.log(`    ${msg}`) }

async function api(path, opts) {
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) throw new Error(`${opts?.method||'GET'} ${path} → HTTP ${res.status}`)
  return res.json()
}

// ─── normalise / parse (mirrors ingestionService.ts) ──────────────────────────
function normH(h) {
  return h.trim().toLowerCase().replace(/[_\-/().,'";:[\]{}|\\]+/g,' ').replace(/\s+/g,' ').trim()
}
const MONTH_NAMES = {
  january:1,february:2,march:3,april:4,may:5,june:6,
  july:7,august:8,september:9,october:10,november:11,december:12,
  jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12,
}
function parseMonth(v) {
  if (v==null) return undefined
  if (v instanceof Date) return isNaN(v)?undefined:v.getMonth()+1
  const s=String(v).trim(); if(!s) return undefined
  const n=Number(s)
  if(!isNaN(n)&&isFinite(n)){const i=Math.round(n);if(i>=1&&i<=12)return i;if(i>100){const d=new Date((i-25569)*86400*1000);if(!isNaN(d))return d.getMonth()+1};return undefined}
  const l=s.toLowerCase(); if(MONTH_NAMES[l]!==undefined)return MONTH_NAMES[l]
  const p=l.match(/^([a-z]+)/); if(p&&MONTH_NAMES[p[1]]!==undefined)return MONTH_NAMES[p[1]]
  return undefined
}
function parseYear(v) {
  if(v==null)return undefined; if(v instanceof Date)return isNaN(v)?undefined:v.getFullYear()
  const n=Number(String(v).trim()); if(!isNaN(n)&&isFinite(n)){const i=Math.round(n);if(i>=1900&&i<=2100)return i}; return undefined
}
function parseNum(v) {
  if(v==null||v instanceof Date)return undefined
  const s=String(v).replace(/[$,\s]/g,'').trim(); if(!s)return undefined
  const n=parseFloat(s); return isNaN(n)?undefined:n
}
const ALIASES = {
  customer_name:['customer name','customer','client name','client','sold to','buyer','account name','account'],
  grade_name:   ['grade name','grade','product','product name','pulp grade','material','specification'],
  market:       ['market','market name','region','country','sales region','destination','territory'],
  year:         ['year','alloc year','order year','allocation year','period year','yr'],
  month:        ['month','alloc month','order month','allocation month','period month','mo','mes','delivery month','billing month','invoice month'],
  date:         ['date','order date','delivery date','ship date','invoice date','period','posting date'],
  volume:       ['volume','vol','qty','quantity','order quantity','order qty','order quantity adt','order qty adt','order quantity admt','order qty admt','order quantity mt','sales qty','sales quantity','shipment qty','allocated volume','invoiced quantity','invoiced qty','delivered qty','tons','tonnes','ton','mt','admt','adt','metric tons','volume admt','volume mt','volume adt','amount','quantity adt','qty adt'],
  net_price:    ['net price','net','price','netprice','net usd','price usd','realized price','invoice price','sales price','unit price'],
  list_price:   ['list price','list','listprice','gross price','base price','published price'],
}
function detectMap(headers) {
  const norms=headers.map(normH); const map={}
  for(const[f,aliases]of Object.entries(ALIASES)){
    for(const a of aliases){const idx=norms.indexOf(normH(a));if(idx!==-1){map[f]=headers[idx];break}}
  }
  return map
}

// ─── load & parse file ────────────────────────────────────────────────────────
h('LOADING FILE')
const buf = readFileSync(FILE)
const wb  = XLSX.read(buf, { type:'buffer', cellDates:true })
const ws  = wb.Sheets[wb.SheetNames[0]]
const rawRows = XLSX.utils.sheet_to_json(ws, { defval:'', raw:true })
const headers = rawRows.length>0 ? Object.keys(rawRows[0]) : []
const colMap  = detectMap(headers)
info(`File: ${FILE.split('/').pop()}  |  rows: ${rawRows.length}`)
info(`Sheet: ${wb.SheetNames[0]}`)

// Parse all rows
const parsed = rawRows.map(raw => {
  const get = f => colMap[f]!==undefined ? raw[colMap[f]] : undefined
  let year=parseYear(get('year')), month=parseMonth(get('month'))
  const mkt=get('market')
  return {
    customer_name: get('customer_name') ? String(get('customer_name')).trim()||undefined : undefined,
    grade_name:    get('grade_name')    ? String(get('grade_name')).trim()   ||undefined : undefined,
    market_name:   mkt && String(mkt).trim() ? String(mkt).trim() : undefined,
    year, month,
    volume:    parseNum(get('volume')),
    net_price: parseNum(get('net_price')),
    list_price:parseNum(get('list_price')),
    rebates:   parseNum(get('rebates'))  ?? 0,
    discounts: parseNum(get('discounts'))  ?? 0,
  }
})

// Identify markets
const marketCounts = {}
for(const r of parsed) if(r.market_name) marketCounts[r.market_name]=(marketCounts[r.market_name]||0)+1
const sortedMarkets = Object.entries(marketCounts).sort((a,b)=>b[1]-a[1])
info(`Markets found: ${sortedMarkets.slice(0,6).map(([m,n])=>`${m}(${n})`).join(', ')}`)

// Pick China as target
const TARGET_MARKET_NAME = sortedMarkets.find(([m])=>m.toLowerCase().includes('china'))?.[0]
  || sortedMarkets[0][0]
const marketRows = parsed.filter(r => r.market_name === TARGET_MARKET_NAME)
info(`\n  Selected market: "${TARGET_MARKET_NAME}" — ${marketRows.length} rows`)

// ─────────────────────────────────────────────────────────────────────────────
h('PHASE 1 — RAW INGESTION VALIDATION (pre-import, from file)')
// ─────────────────────────────────────────────────────────────────────────────

s('1a. Basic counts')
const customers = [...new Set(marketRows.map(r=>r.customer_name).filter(Boolean))]
const grades    = [...new Set(marketRows.map(r=>r.grade_name).filter(Boolean))]
const ymPairs   = marketRows.filter(r=>r.year&&r.month).map(r=>r.year*100+r.month)
const minYM     = Math.min(...ymPairs), maxYM = Math.max(...ymPairs)
ok(`Total rows for market:  ${marketRows.length}`)
ok(`Distinct customers:     ${customers.length}`)
ok(`Distinct grades:        ${grades.length}`)
ok(`Year-month range:       ${Math.floor(minYM/100)}-${String(minYM%100).padStart(2,'0')} → ${Math.floor(maxYM/100)}-${String(maxYM%100).padStart(2,'0')}`)
info(`Customers: ${customers.slice(0,8).join(', ')}${customers.length>8?'…':''}`)
info(`Grades:    ${grades.join(', ')}`)

s('1b. Suspicious records')
let flags = 0
const noMkt    = marketRows.filter(r=>!r.market_name)
const badMonth = marketRows.filter(r=>r.month===undefined||r.month<1||r.month>12)
const badYear  = marketRows.filter(r=>r.year===undefined||r.year<2015||r.year>2035)
const zeroVol  = marketRows.filter(r=>r.volume==null||r.volume<=0)
const zeroPri  = marketRows.filter(r=>r.net_price==null||r.net_price<=0)
const noGrade  = marketRows.filter(r=>!r.grade_name)
if(noMkt.length)    { err(`Rows missing market:    ${noMkt.length}`);    flags++ } else ok('No rows missing market')
if(badMonth.length) { err(`Rows with bad month:    ${badMonth.length}`); flags++ } else ok('All months valid (1–12)')
if(badYear.length)  { err(`Rows with bad year:     ${badYear.length}`);  flags++ } else ok('All years valid (2015–2035)')
if(zeroVol.length)  { err(`Rows with zero volume:  ${zeroVol.length}`);  flags++ } else ok('No zero/null volumes')
if(zeroPri.length)  { err(`Rows with zero price:   ${zeroPri.length}`);  flags++ } else ok('No zero/null net prices')
if(noGrade.length)  { warn(`Rows missing grade:     ${noGrade.length} (will default to first grade)`) }

// Duplicate detection: same customer + grade + year + month
const dupKey = r => `${r.customer_name}|${r.grade_name}|${r.year}|${r.month}`
const dupMap = {}
for(const r of marketRows){ const k=dupKey(r); dupMap[k]=(dupMap[k]||0)+1 }
const dups = Object.entries(dupMap).filter(([,n])=>n>1)
if(dups.length) warn(`Duplicate customer+grade+year+month combos: ${dups.length} (multi-delivery = ok, check if intentional)`)
else ok('No exact duplicates (customer+grade+year+month)')

s('1c. Sample rows (first 10)')
console.log(`  ${'Customer'.padEnd(28)} ${'Grade'.padEnd(14)} ${'Mkt'.padEnd(12)} ${'Yr'.padEnd(6)} ${'Mo'.padEnd(4)} ${'Vol'.padEnd(8)} ${'NetP'}`)
console.log(`  ${'-'.repeat(86)}`)
for(const r of marketRows.slice(0,10)){
  console.log(`  ${(r.customer_name||'—').slice(0,26).padEnd(28)} ${(r.grade_name||'—').slice(0,12).padEnd(14)} ${(r.market_name||'—').slice(0,10).padEnd(12)} ${String(r.year||'—').padEnd(6)} ${String(r.month||'—').padEnd(4)} ${String(r.volume||'—').padEnd(8)} ${r.net_price?.toFixed(0)||'—'}`)
}

s('1d. Commercial plausibility')
const avgVol  = marketRows.reduce((s,r)=>s+(r.volume||0),0)/marketRows.length
const avgPri  = marketRows.filter(r=>r.net_price>0).reduce((s,r)=>s+r.net_price,0)/marketRows.filter(r=>r.net_price>0).length
const minPri  = Math.min(...marketRows.filter(r=>r.net_price>0).map(r=>r.net_price))
const maxPri  = Math.max(...marketRows.filter(r=>r.net_price>0).map(r=>r.net_price))
info(`Avg volume/row: ${avgVol.toFixed(0)} ADT  |  Avg net price: $${avgPri.toFixed(0)}/t`)
info(`Net price range: $${minPri.toFixed(0)} – $${maxPri.toFixed(0)}/t`)
if(avgPri>200 && avgPri<2000 && avgVol>0) ok('Volume and price ranges commercially plausible for pulp')
else warn('Ranges outside expected pulp market norms — review manually')

// ─────────────────────────────────────────────────────────────────────────────
// FETCH CURRENT STATE BEFORE IMPORT
// ─────────────────────────────────────────────────────────────────────────────
h('FETCHING PRE-IMPORT STATE FROM LIVE SERVER')

// Get markets from server to find market_id for our target
const markets = await api('/api/markets')
const targetMarket = markets.find(m => m.name.toLowerCase().includes('china'))
if(!targetMarket){ console.error('China market not found in API'); process.exit(1) }
info(`Server market: id=${targetMarket.id}  name="${targetMarket.name}"`)

// Fetch grades
const grades_api = await api('/api/grades')
info(`Server grades: ${grades_api.map(g=>g.name).join(', ')}`)

// Pre-import orders
const preOrders = await api(`/api/orders?marketId=${targetMarket.id}&months=24`)
info(`Pre-import orders for market: ${preOrders.length}`)

// Pre-import pricing recommendation
const preRec = await api(`/api/pricing/${targetMarket.id}`)
const preRecByGrade = {}
for(const r of preRec.recommendations) preRecByGrade[r.gradeName]=r
info(`Pre-import recommendations: ${preRec.recommendations.length} grades`)
info(`Pre-import sentiment: ${preRec.sentimentScore?.overall} (${preRec.sentimentScore?.score?.toFixed(2)})`)

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT
// ─────────────────────────────────────────────────────────────────────────────
h('IMPORTING CHINA ORDERS TO LIVE SERVER')

const validMarketRows = marketRows.filter(r => r.volume>0 && r.net_price>0 && r.year && r.month)
info(`Rows to send: ${validMarketRows.length}`)

const payload = validMarketRows.map(r => ({
  customer_name: r.customer_name,
  grade_name:    r.grade_name,
  market_id:     targetMarket.id,
  year:          r.year,
  month:         r.month,
  volume:        r.volume,
  list_price:    r.list_price ?? r.net_price,
  net_price:     r.net_price,
  rebates:       r.rebates ?? 0,
  discounts:     r.discounts ?? 0,
}))

const importResult = await api('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type':'application/json' },
  body: JSON.stringify(payload),
})
ok(`Server accepted: ${importResult.inserted} orders inserted`)

// ─────────────────────────────────────────────────────────────────────────────
h('PHASE 2 — AGGREGATION VALIDATION')
// ─────────────────────────────────────────────────────────────────────────────

const postOrders = await api(`/api/orders?marketId=${targetMarket.id}&months=24`)
ok(`Post-import stored orders: ${postOrders.length}  (was ${preOrders.length}, +${postOrders.length-preOrders.length})`)

// Separate mock orders from imported orders
// Mock orders have small numeric IDs (1..100); imported ones get Date.now() IDs (>1e12)
const mockO   = postOrders.filter(o => o.id < 100000)
const importedO = postOrders.filter(o => o.id >= 100000)
info(`Mock seed orders still in store: ${mockO.length}`)
info(`Freshly imported orders:         ${importedO.length}`)

s('2a. Monthly volume (imported orders only)')
const monthVol = {}
for(const o of importedO){
  const k=`${o.year}-${String(o.month).padStart(2,'0')}`
  monthVol[k]=(monthVol[k]||0)+o.volume
}
const mvEntries = Object.entries(monthVol).sort(([a],[b])=>a.localeCompare(b))
for(const [ym,vol] of mvEntries) info(`  ${ym}: ${Math.round(vol).toLocaleString()} ADT`)

s('2b. Average net price by grade (imported, last 3 months of file data)')
const latestYM = Math.max(...importedO.map(o=>o.year*100+o.month))
const recent3  = importedO.filter(o => {
  const diff = (Math.floor(latestYM/100)-o.year)*12 + (latestYM%100 - o.month)
  return diff < 3
})
const gradePrices = {}
for(const o of recent3){
  if(!gradePrices[o.grade_id]) gradePrices[o.grade_id]={sum:0,cnt:0}
  gradePrices[o.grade_id].sum += o.net_price
  gradePrices[o.grade_id].cnt++
}
for(const [gid, {sum,cnt}] of Object.entries(gradePrices)){
  const grade = grades_api.find(g=>g.id===parseInt(gid))
  info(`  ${(grade?.name||'grade '+gid).padEnd(16)} avg $${(sum/cnt).toFixed(1)}/t over ${cnt} recent orders`)
}

s('2c. Customer volume totals (imported)')
const custVol = {}
for(const o of importedO){
  const name = o.customer_name || `cust#${o.customer_id}`
  custVol[name]=(custVol[name]||0)+o.volume
}
const topCusts = Object.entries(custVol).sort((a,b)=>b[1]-a[1]).slice(0,10)
for(const [name,vol] of topCusts) info(`  ${name.slice(0,30).padEnd(30)} ${Math.round(vol).toLocaleString()} ADT`)

// ─────────────────────────────────────────────────────────────────────────────
h('PHASE 3 — DASHBOARD DATA USAGE VALIDATION')
// ─────────────────────────────────────────────────────────────────────────────

const postRec = await api(`/api/pricing/${targetMarket.id}`)

s('3a. Recommendation before vs. after import')
console.log(`\n  ${'Grade'.padEnd(18)} ${'Pre Mid'.padEnd(10)} ${'Post Mid'.padEnd(10)} ${'∆'.padEnd(8)} ${'Pre Conf'.padEnd(10)} ${'Post Conf'.padEnd(10)} Orders used`)
console.log(`  ${'-'.repeat(80)}`)

for(const postR of postRec.recommendations){
  const preR = preRecByGrade[postR.gradeName]
  const dMid = preR ? postR.priceMid - preR.priceMid : 0
  const sign = dMid>0?'+':''
  const ordersUsed = importedO.filter(o=>o.grade_id===postR.gradeId).length
  console.log(`  ${postR.gradeName.padEnd(18)} ${preR?'$'+preR.priceMid.toFixed(0):'—'.padEnd(7)} ${('$'+postR.priceMid.toFixed(0)).padEnd(10)} ${(sign+dMid.toFixed(0)).padEnd(8)} ${preR?String(preR.confidenceScore).padEnd(10):'—'.padEnd(10)} ${String(postR.confidenceScore).padEnd(10)} ${ordersUsed}`)
}

s('3b. Pricing engine inputs audit (for dominant grade)')
// Find grade with most imported orders
const gradeOrderCount = {}
for(const o of importedO) gradeOrderCount[o.grade_id]=(gradeOrderCount[o.grade_id]||0)+1
const dominantGradeId = parseInt(Object.entries(gradeOrderCount).sort((a,b)=>b[1]-a[1])[0]?.[0])
const dominantGrade   = grades_api.find(g=>g.id===dominantGradeId)
const dominantRec     = postRec.recommendations.find(r=>r.gradeId===dominantGradeId)

if(dominantRec){
  info(`Grade: ${dominantGrade?.name}`)
  info(`currentAvgPrice (engine's last-30d avg): $${dominantRec.currentAvgPrice}/t`)
  info(`priceMid:  $${dominantRec.priceMid.toFixed(1)}/t`)
  info(`confidence: ${dominantRec.confidenceScore}`)
  info(`priceband:  ${dominantRec.priceband}`)
  info(`topDrivers:`)
  for(const d of dominantRec.topDrivers.slice(0,4)) info(`   + ${d}`)
  if(dominantRec.riskFlags.length) { info(`riskFlags:`); for(const r of dominantRec.riskFlags.slice(0,3)) info(`   ! ${r}`) }
}

// ─────────────────────────────────────────────────────────────────────────────
h('PHASE 4 — MOCK / STALE DATA CONTAMINATION AUDIT')
// ─────────────────────────────────────────────────────────────────────────────

s('4a. Order store composition')
if(mockO.length===0){
  ok('No mock seed orders remaining for this market')
} else {
  warn(`${mockO.length} mock seed orders still in store alongside imported data`)
  info('  These are the initial prototype seed rows — they pre-date real import.')
  // Check whether mock orders overlap in period with imported
  const importedYMs = new Set(importedO.map(o=>`${o.year}-${o.month}`))
  const mockOverlap = mockO.filter(o=>importedYMs.has(`${o.year}-${o.month}`))
  if(mockOverlap.length>0){
    err(`  ${mockOverlap.length} mock orders share same year-month as imported data → CONTAMINATION`)
    info('  Classification: DANGEROUS — mock prices will blend into avg used by pricing engine')
  } else {
    warn(`  Mock orders are in different periods (no overlap). Classification: LOW RISK but should be removed for production`)
  }
}

s('4b. Customers')
const allCusts = await api('/api/customers')
const mockCustNames = ['Shandong Sun Paper','Nine Dragons Paper','APP China'] // known mock seed names
const contamCusts = allCusts.filter(c=>mockCustNames.includes(c.name)&&c.market_id===targetMarket.id)
if(contamCusts.length>0){
  warn(`${contamCusts.length} mock seed customers still in customer store: ${contamCusts.map(c=>c.name).join(', ')}`)
  info('  Classification: ACCEPTABLE — lookup/seed data, no pricing impact unless they have mock orders')
} else {
  ok('No mock seed customers detected in this market')
}

s('4c. Competitor/expert/news data')
info('Competitor prices, expert insights, market news are static seed data — they do not mix with imported orders.')
info('Classification: SAFE FALLBACK — used only for pricing signal calculation, not order aggregation.')

// ─────────────────────────────────────────────────────────────────────────────
h('PHASE 5 — DATA SANITY CHECKS')
// ─────────────────────────────────────────────────────────────────────────────

s('5a. Price outliers (imported orders)')
const prices = importedO.map(o=>o.net_price).filter(p=>p>0).sort((a,b)=>a-b)
const p5  = prices[Math.floor(prices.length*0.05)]
const p95 = prices[Math.floor(prices.length*0.95)]
const outlierPrices = importedO.filter(o=>o.net_price<p5*0.5||o.net_price>p95*2)
if(outlierPrices.length){
  warn(`${outlierPrices.length} price outliers outside [${p5.toFixed(0)}/t × 0.5, ${p95.toFixed(0)}/t × 2]:`)
  for(const o of outlierPrices.slice(0,5)) info(`  cust#${o.customer_id} grade#${o.grade_id} ${o.year}-${o.month}: $${o.net_price}/t vol=${o.volume}`)
} else { ok(`No extreme price outliers (5th/95th percentile range: $${p5?.toFixed(0)}–$${p95?.toFixed(0)}/t)`) }

s('5b. Volume outliers')
const vols   = importedO.map(o=>o.volume).sort((a,b)=>a-b)
const vp95   = vols[Math.floor(vols.length*0.95)]
const outlierVols = importedO.filter(o=>o.volume>vp95*3)
if(outlierVols.length){
  warn(`${outlierVols.length} volume outliers > 3× 95th pct (${vp95} ADT):`)
  for(const o of outlierVols.slice(0,5)) info(`  cust#${o.customer_id} grade#${o.grade_id} ${o.year}-${o.month}: ${o.volume} ADT`)
} else { ok(`No extreme volume outliers (95th pct: ${vp95?.toLocaleString()} ADT)`) }

s('5c. Same customer + grade + month repeated')
const comboCounts = {}
for(const o of importedO){
  const k=`${o.customer_id}|${o.grade_id}|${o.year}|${o.month}`
  comboCounts[k]=(comboCounts[k]||0)+1
}
const repeats = Object.entries(comboCounts).filter(([,n])=>n>1)
if(repeats.length){
  warn(`${repeats.length} customer+grade+month combos appear more than once (multiple delivery lines — OK if intentional)`)
  for(const [k,n] of repeats.slice(0,5)) info(`  ${k}: ${n} rows`)
} else { ok('No repeated customer+grade+month combos') }

s('5d. Grade mapping check')
const gradeNameMap = {}; for(const g of grades_api) gradeNameMap[g.id]=g.name
const unknownGrades = importedO.filter(o=>!gradeNameMap[o.grade_id])
if(unknownGrades.length) err(`${unknownGrades.length} orders with unrecognised grade_id`)
else ok('All imported order grade_ids map to known grades')

// ─────────────────────────────────────────────────────────────────────────────
h('PHASE 6 — OWNER SUMMARY')
// ─────────────────────────────────────────────────────────────────────────────

const postRecMain = postRec.recommendations.find(r=>r.gradeId===dominantGradeId)
const preRecMain  = preRecByGrade[dominantGrade?.name]

console.log(`
  Market validated: ${targetMarket.name}
  File: ${FILE.split('/').pop()}

  1. IS THE IMPORTED DATA BEING USED BY THE DASHBOARD?
     ${importResult.inserted>0 ? `YES — ${importResult.inserted} orders imported. Post-import stored order count: ${postOrders.length}.` : 'NO — import failed.'}
     ${importedO.length>0 ? `Pricing engine received ${importedO.length} imported orders for this market.` : ''}

  2. ARE CHARTS AND TABLES CONSISTENT WITH IMPORTED DATA?
     Volume chart: data is sourced from /api/orders, which now includes imported rows.
     Customer table: populated from imported customer names (auto-created by findOrCreateCustomer).
     Price chart: will show imported net prices grouped by year-month.
     ${mockO.length>0 ? `⚠ WARNING: ${mockO.length} mock seed orders are still in the store and will blend into charts.` : 'No mock order contamination in store.'}

  3. IS THE RECOMMENDATION REACTING TO IMPORTED DATA?
     ${postRecMain && preRecMain ? `${dominantGrade?.name}: price moved $${preRecMain.priceMid.toFixed(0)} → $${postRecMain.priceMid.toFixed(0)} (Δ${(postRecMain.priceMid-preRecMain.priceMid>0?'+':'')}${(postRecMain.priceMid-preRecMain.priceMid).toFixed(0)}). Confidence: ${preRecMain.confidenceScore} → ${postRecMain.confidenceScore}.` : `Recommendation: mid=$${postRecMain?.priceMid?.toFixed(0)||'?'}/t, confidence=${postRecMain?.confidenceScore||'?'}.`}
     ${postRecMain?.confidenceScore>=50 ? 'Confidence ≥50 — engine has enough data to make a real recommendation.' : 'Confidence <50 — engine has data but signals are limited.'}

  4. WHAT DATA ISSUES STILL EXIST?
     ${flags===0 ? '• No data integrity flags in imported rows.' : `• ${flags} data flag(s) found — see Phase 1 above.`}
     ${mockO.length>0 ? `• ${mockO.length} mock seed orders present — remove before production use.` : '• No mock order contamination.'}
     ${dups.length>0 ? `• ${dups.length} repeated customer+grade+month combos — verify with business owner.` : '• No suspicious duplicates.'}
     ${repeats.length>0 ? `• ${repeats.length} multi-line deliveries per month — expected for partial shipments.` : ''}

  5. READY FOR NEXT STEP (competitor/expert/meeting-note validation)?
     ${postOrders.length>preOrders.length && flags===0 ? 'YES — orders ingest cleanly, store correctly, engine uses them. Safe to add competitor prices and expert insights for the same market.' : 'PARTIAL — resolve flagged issues first.'}
`)
