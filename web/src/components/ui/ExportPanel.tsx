'use client'

import toast from 'react-hot-toast'
import type { ExportData } from '@/types'

interface ExportPanelProps extends Partial<ExportData> {
  onClose: () => void
  marketId?: number
}

// ─── PDF ─────────────────────────────────────────────────────────────────────
async function generatePdf(props: ExportPanelProps) {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const { marketName = 'All Markets', recommendations = [], sentimentScore, orders = [] } = props
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' })
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { dateStyle: 'full' })
  const W = doc.internal.pageSize.getWidth()

  // Colours
  const BG = [13, 17, 23] as const
  const PANEL = [30, 41, 59] as const
  const WHITE = [230, 237, 243] as const
  const MUTED = [100, 116, 139] as const
  const GREEN = [16, 185, 129] as const
  const RED = [239, 68, 68] as const
  const AMBER = [245, 158, 11] as const
  const BRAND = [59, 130, 246] as const

  const bg = () => { doc.setFillColor(...BG); doc.rect(0, 0, W, 210, 'F') }

  // ── PAGE 1: HEADER + RECOMMENDATION BANDS ──────────────────────────────────
  bg()

  doc.setFillColor(...BRAND)
  doc.rect(0, 0, W, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('PULP PRICING INTELLIGENCE', 14, 12)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`${marketName} — ${dateStr}`, W - 14, 12, { align: 'right' })

  let y = 28
  doc.setTextColor(...WHITE)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`${marketName} — Pricing Recommendations`, 14, y)

  if (sentimentScore) {
    const sentColor: readonly [number, number, number] = sentimentScore.overall === 'bullish' ? GREEN : sentimentScore.overall === 'bearish' ? RED : AMBER
    doc.setTextColor(...sentColor)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Market Sentiment: ${sentimentScore.overall.toUpperCase()} (${sentimentScore.score.toFixed(2)})`, W - 14, y, { align: 'right' })
  }

  y += 8

  if (recommendations.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Grade', 'Current Price', 'Low Band', 'Mid (Rec)', 'High Band', 'Band', 'Confidence', 'Vol Impact', 'Margin Impact']],
      body: recommendations.map(r => [
        r.gradeName,
        `$${r.currentAvgPrice.toFixed(0)}/t`,
        `$${r.priceLow.toFixed(0)}`,
        `$${r.priceMid.toFixed(0)}`,
        `$${r.priceHigh.toFixed(0)}`,
        r.priceband.toUpperCase(),
        `${r.confidenceScore}%`,
        `${r.expectedVolumeImpact >= 0 ? '+' : ''}${r.expectedVolumeImpact.toFixed(1)}%`,
        `${r.expectedMarginImpact >= 0 ? '+' : ''}${r.expectedMarginImpact.toFixed(1)}%`,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fillColor: [...PANEL], textColor: [...WHITE], fontSize: 8 },
      alternateRowStyles: { fillColor: [15, 23, 42] },
      columnStyles: {
        5: { halign: 'center' },
        6: { halign: 'center' },
        7: { halign: 'right' },
        8: { halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10

    // ── DRIVERS & RISKS section ─────────────────────────────────────────────
    recommendations.forEach(r => {
      if (y > 175) { doc.addPage(); bg(); y = 20 }

      doc.setFillColor(...PANEL)
      doc.roundedRect(14, y, W - 28, 7, 1, 1, 'F')
      doc.setTextColor(...WHITE)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text(`${r.gradeName} — Drivers & Risks`, 18, y + 5)
      y += 10

      if (r.topDrivers.length > 0) {
        doc.setTextColor(...GREEN)
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'bold')
        doc.text('DRIVERS', 18, y)
        y += 4
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...WHITE)
        r.topDrivers.slice(0, 4).forEach(d => {
          if (y > 195) { doc.addPage(); bg(); y = 20 }
          doc.text(`▸ ${d}`, 22, y)
          y += 4.5
        })
      }

      if (r.riskFlags.length > 0) {
        y += 1
        doc.setTextColor(...RED)
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'bold')
        doc.text('RISKS', 18, y)
        y += 4
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...WHITE)
        r.riskFlags.slice(0, 4).forEach(d => {
          if (y > 195) { doc.addPage(); bg(); y = 20 }
          doc.text(`▸ ${d}`, 22, y)
          y += 4.5
        })
      }

      doc.setTextColor(...MUTED)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'italic')
      if (y < 195) {
        doc.text(r.reasoning.slice(0, 200), 22, y, { maxWidth: W - 44 })
      }
      y += 10
    })
  }

  // ── PAGE 2: ORDER SUMMARY ───────────────────────────────────────────────────
  if (orders.length > 0) {
    doc.addPage()
    bg()
    doc.setFillColor(...BRAND)
    doc.rect(0, 0, W, 18, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('ORDER HISTORY SUMMARY', 14, 12)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Last 6 months — ${orders.length} orders`, W - 14, 12, { align: 'right' })

    const sorted = [...orders].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)
    autoTable(doc, {
      startY: 24,
      head: [['Date', 'Customer ID', 'Grade ID', 'Volume (t)', 'List Price', 'Net Price', 'Rebates', 'Discounts']],
      body: sorted.map(o => [
        o.date,
        o.customer_id,
        o.grade_id,
        o.volume.toLocaleString(),
        `$${o.list_price.toFixed(0)}`,
        `$${o.net_price.toFixed(0)}`,
        `$${o.rebates.toFixed(0)}`,
        `$${o.discounts.toFixed(0)}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fillColor: [...PANEL], textColor: [...WHITE], fontSize: 7.5 },
      alternateRowStyles: { fillColor: [15, 23, 42] },
      margin: { left: 14, right: 14 },
    })
  }

  const fileName = `pulp-pricing-${marketName.toLowerCase().replace(/\s+/g, '-')}-${now.toISOString().slice(0, 10)}.pdf`
  doc.save(fileName)
}

// ─── EXCEL ────────────────────────────────────────────────────────────────────
async function generateExcel(props: ExportPanelProps) {
  const XLSX = await import('xlsx')
  const { marketName = 'All Markets', recommendations = [], orders = [], competitorPrices = [], sentimentScore } = props
  const now = new Date()
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const summaryData: (string | number | null)[][] = [
    ['PULP PRICING INTELLIGENCE — EXECUTIVE SUMMARY'],
    [],
    ['Market', marketName],
    ['Generated', now.toLocaleString()],
    ['Orders (6mo)', orders.length],
    ['Grades priced', recommendations.length],
    [],
    ['SENTIMENT'],
    ['Overall', sentimentScore?.overall ?? 'N/A'],
    ['Score', sentimentScore?.score ?? 'N/A'],
    ['News component', sentimentScore?.sources.news ?? 'N/A'],
    ['Expert component', sentimentScore?.sources.expert ?? 'N/A'],
    ['Meeting notes component', sentimentScore?.sources.meetingNotes ?? 'N/A'],
  ]
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  summarySheet['!cols'] = [{ wch: 30 }, { wch: 25 }]
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  // ── Sheet 2: Pricing Recommendations ─────────────────────────────────────
  if (recommendations.length > 0) {
    const recHeaders = [
      'Grade', 'Current Avg Price', 'Price Low', 'Price Mid (Rec)', 'Price High',
      'Recommended Band', 'Confidence Score', 'Volume Impact %', 'Margin Impact %',
      'Top Driver 1', 'Top Driver 2', 'Top Driver 3',
      'Risk Flag 1', 'Risk Flag 2',
      'Reasoning',
    ]
    const recRows = recommendations.map(r => [
      r.gradeName,
      r.currentAvgPrice,
      r.priceLow,
      r.priceMid,
      r.priceHigh,
      r.priceband.toUpperCase(),
      r.confidenceScore,
      r.expectedVolumeImpact,
      r.expectedMarginImpact,
      r.topDrivers[0] ?? '',
      r.topDrivers[1] ?? '',
      r.topDrivers[2] ?? '',
      r.riskFlags[0] ?? '',
      r.riskFlags[1] ?? '',
      r.reasoning,
    ])
    const recSheet = XLSX.utils.aoa_to_sheet([recHeaders, ...recRows])
    recSheet['!cols'] = recHeaders.map((_, i) => ({ wch: i < 9 ? 18 : 40 }))
    XLSX.utils.book_append_sheet(wb, recSheet, 'Recommendations')
  }

  // ── Sheet 3: Orders ───────────────────────────────────────────────────────
  if (orders.length > 0) {
    const orderHeaders = ['Date', 'Customer ID', 'Grade ID', 'Volume (t)', 'List Price', 'Net Price', 'Rebates', 'Discounts']
    const orderRows = [...orders]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(o => [o.date, o.customer_id, o.grade_id, o.volume, o.list_price, o.net_price, o.rebates, o.discounts])
    const orderSheet = XLSX.utils.aoa_to_sheet([orderHeaders, ...orderRows])
    orderSheet['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, orderSheet, 'Orders')
  }

  // ── Sheet 4: Competitor Prices ─────────────────────────────────────────────
  if (competitorPrices.length > 0) {
    const cpHeaders = ['Market ID', 'Grade ID', 'Price', 'Date', 'Source']
    const cpRows = [...competitorPrices]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(cp => [cp.market_id, cp.grade_id, cp.price, cp.date, cp.source])
    const cpSheet = XLSX.utils.aoa_to_sheet([cpHeaders, ...cpRows])
    cpSheet['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, cpSheet, 'Competitor Prices')
  }

  const fileName = `pulp-pricing-${marketName.toLowerCase().replace(/\s+/g, '-')}-${now.toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, fileName)
}

// ─── PowerPoint-ready HTML summary ───────────────────────────────────────────
function generatePptxHtml(props: ExportPanelProps) {
  const { marketName = 'All Markets', recommendations = [], sentimentScore, orders = [] } = props
  const now = new Date().toLocaleDateString('en-US', { dateStyle: 'long' })

  const sentColor = sentimentScore?.overall === 'bullish' ? '#10b981'
    : sentimentScore?.overall === 'bearish' ? '#ef4444' : '#f59e0b'

  const totalVolume = orders.reduce((s, o) => s + o.volume, 0)
  const avgNetPrice = orders.length > 0
    ? orders.reduce((s, o) => s + o.net_price, 0) / orders.length
    : 0
  const avgConfidence = recommendations.length > 0
    ? Math.round(recommendations.reduce((s, r) => s + r.confidenceScore, 0) / recommendations.length)
    : 0

  const recRows = recommendations.map(r => {
    const bandColor = r.priceband === 'high' ? '#10b981' : r.priceband === 'low' ? '#ef4444' : '#f59e0b'
    const diff = r.currentAvgPrice > 0 ? ((r.priceMid - r.currentAvgPrice) / r.currentAvgPrice * 100) : 0
    return `
      <tr>
        <td>${r.gradeName}</td>
        <td>$${r.currentAvgPrice.toFixed(0)}</td>
        <td>$${r.priceLow.toFixed(0)} – $${r.priceHigh.toFixed(0)}</td>
        <td style="font-weight:700">$${r.priceMid.toFixed(0)}</td>
        <td style="color:${diff >= 0 ? '#10b981' : '#ef4444'}">${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%</td>
        <td style="color:${bandColor};font-weight:700">${r.priceband.toUpperCase()}</td>
        <td>${r.confidenceScore}%</td>
      </tr>`
  }).join('')

  const driversHtml = recommendations.map(r => `
    <div class="slide-section">
      <h3 style="margin:0 0 6px;font-size:13px;color:#94a3b8">${r.gradeName}</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <div style="font-size:10px;color:#10b981;font-weight:700;margin-bottom:4px">DRIVERS</div>
          ${r.topDrivers.slice(0, 4).map(d => `<div style="font-size:10px;color:#e2e8f0;margin-bottom:2px">▸ ${d}</div>`).join('')}
        </div>
        <div>
          <div style="font-size:10px;color:#ef4444;font-weight:700;margin-bottom:4px">RISKS</div>
          ${r.riskFlags.slice(0, 4).map(d => `<div style="font-size:10px;color:#e2e8f0;margin-bottom:2px">▸ ${d}</div>`).join('')}
        </div>
      </div>
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Pulp Pricing — ${marketName} — ${now}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #0d1117; color: #e2e8f0; }
  .slide {
    width: 297mm; min-height: 167mm; padding: 16mm 18mm; margin: 0 auto 8mm;
    background: #0f172a; border: 1px solid #1e293b;
    page-break-after: always;
  }
  .slide-header {
    background: #1d4ed8; padding: 10px 14px; border-radius: 6px;
    margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;
  }
  .slide-header h1 { font-size: 15px; font-weight: 700; color: #fff; }
  .slide-header .meta { font-size: 10px; color: #bfdbfe; }
  .kpi-row { display: flex; gap: 12px; margin-bottom: 14px; }
  .kpi { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px 14px; flex: 1; }
  .kpi .label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 3px; }
  .kpi .value { font-size: 18px; font-weight: 700; color: #f8fafc; }
  .kpi .sub { font-size: 9px; color: #94a3b8; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #1e3a8a; color: #fff; padding: 6px 8px; text-align: left; font-size: 9px; text-transform: uppercase; }
  td { padding: 5px 8px; border-bottom: 1px solid #1e293b; color: #e2e8f0; }
  tr:nth-child(even) td { background: #0f172a; }
  .slide-section { background: #1e293b; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; }
  .footer { font-size: 8px; color: #475569; margin-top: 10px; text-align: right; }
  @media print {
    body { background: #0d1117; }
    .slide { margin: 0; border: none; page-break-after: always; }
  }
</style>
</head>
<body>

<!-- SLIDE 1: Overview -->
<div class="slide">
  <div class="slide-header">
    <h1>PULP PRICING INTELLIGENCE — ${marketName.toUpperCase()}</h1>
    <div class="meta">${now} &nbsp;|&nbsp; ARAUCO Pricing Intelligence Platform</div>
  </div>
  <div class="kpi-row">
    <div class="kpi">
      <div class="label">Overall Sentiment</div>
      <div class="value" style="color:${sentColor}">${(sentimentScore?.overall ?? 'N/A').toUpperCase()}</div>
      <div class="sub">Score: ${sentimentScore?.score.toFixed(2) ?? '—'}</div>
    </div>
    <div class="kpi">
      <div class="label">Avg Net Price</div>
      <div class="value">$${avgNetPrice.toFixed(0)}/t</div>
      <div class="sub">Last 6 months</div>
    </div>
    <div class="kpi">
      <div class="label">Total Volume</div>
      <div class="value">${(totalVolume / 1000).toFixed(0)}k t</div>
      <div class="sub">${orders.length} orders</div>
    </div>
    <div class="kpi">
      <div class="label">Avg Confidence</div>
      <div class="value" style="color:${avgConfidence >= 70 ? '#10b981' : avgConfidence >= 40 ? '#f59e0b' : '#ef4444'}">${avgConfidence}%</div>
      <div class="sub">Across ${recommendations.length} grades</div>
    </div>
  </div>
  <div class="footer">Confidential — Internal Use Only — Pulp Pricing Intelligence v1.0</div>
</div>

<!-- SLIDE 2: Pricing Recommendations -->
<div class="slide">
  <div class="slide-header">
    <h1>PRICING RECOMMENDATIONS — ${marketName.toUpperCase()}</h1>
    <div class="meta">Decision: INCREASE / HOLD / REDUCE by grade</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Grade</th>
        <th>Current Price</th>
        <th>Band (Low–High)</th>
        <th>Recommended</th>
        <th>vs Current</th>
        <th>Decision</th>
        <th>Confidence</th>
      </tr>
    </thead>
    <tbody>${recRows}</tbody>
  </table>
  <div class="footer">Recommendations based on CRM orders + competitor intelligence + expert forecasts</div>
</div>

<!-- SLIDE 3: Drivers & Risks -->
<div class="slide">
  <div class="slide-header">
    <h1>KEY DRIVERS AND RISK FLAGS — ${marketName.toUpperCase()}</h1>
    <div class="meta">Price engine signal analysis</div>
  </div>
  ${driversHtml}
  <div class="footer">Signal extraction from: orders, competitor prices, expert forecasts, news, meeting notes</div>
</div>

<script>window.print()</script>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (!win) {
    toast.error('Pop-up blocked. Allow pop-ups for this site to open the presentation.')
    return
  }
  // Clean up object URL after window loads
  win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true })
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ExportPanel(props: ExportPanelProps) {
  const { marketName, onClose } = props
  const hasData = (props.recommendations?.length ?? 0) > 0

  const handlePdf = async () => {
    onClose()
    const toastId = toast.loading('Generating PDF…')
    try {
      await generatePdf(props)
      toast.success('PDF exported', { id: toastId })
    } catch (err) {
      console.error(err)
      toast.error('PDF export failed', { id: toastId })
    }
  }

  const handleExcel = async () => {
    onClose()
    const toastId = toast.loading('Generating Excel…')
    try {
      await generateExcel(props)
      toast.success('Excel exported', { id: toastId })
    } catch (err) {
      console.error(err)
      toast.error('Excel export failed', { id: toastId })
    }
  }

  const handlePptx = () => {
    onClose()
    try {
      generatePptxHtml(props)
      toast.success('Presentation opened — use Ctrl+P to print or save as PDF', { duration: 6000 })
    } catch (err) {
      console.error(err)
      toast.error('Presentation generation failed')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-lg">Export Report</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {marketName && (
          <div className="mb-3 text-sm text-slate-400">
            Market: <span className="text-white font-medium">{marketName}</span>
            {hasData && (
              <span className="ml-2 text-xs text-emerald-400">
                · {props.recommendations!.length} grades · {props.orders?.length ?? 0} orders
              </span>
            )}
            {!hasData && (
              <span className="ml-2 text-xs text-yellow-400">· limited data</span>
            )}
          </div>
        )}

        <div className="space-y-3">
          {/* PDF */}
          <button
            onClick={handlePdf}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-700/50 border border-slate-600 hover:bg-red-900/20 hover:border-red-700/50 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-red-900/40 flex items-center justify-center group-hover:bg-red-900/60 transition-colors shrink-0">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-left">
              <div className="text-white font-medium text-sm">PDF Report</div>
              <div className="text-slate-400 text-xs">
                {hasData ? 'Price bands, drivers, risks, orders table' : 'Summary report (no pricing data loaded)'}
              </div>
            </div>
            <svg className="w-4 h-4 text-slate-500 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Excel */}
          <button
            onClick={handleExcel}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-700/50 border border-slate-600 hover:bg-emerald-900/20 hover:border-emerald-700/50 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-900/40 flex items-center justify-center group-hover:bg-emerald-900/60 transition-colors shrink-0">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-left">
              <div className="text-white font-medium text-sm">Excel Workbook</div>
              <div className="text-slate-400 text-xs">
                {hasData ? '4 sheets: Summary, Recommendations, Orders, Competitor Prices' : 'Summary sheet only'}
              </div>
            </div>
            <svg className="w-4 h-4 text-slate-500 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* PowerPoint */}
          <button
            onClick={handlePptx}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-700/50 border border-slate-600 hover:bg-orange-900/20 hover:border-orange-700/50 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-orange-900/40 flex items-center justify-center group-hover:bg-orange-900/60 transition-colors shrink-0">
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-left">
              <div className="text-white font-medium text-sm">Presentation Summary</div>
              <div className="text-slate-400 text-xs">
                Opens 3-slide HTML summary — print to PDF or screenshot for PowerPoint
              </div>
            </div>
            <svg className="w-4 h-4 text-slate-500 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <button onClick={onClose} className="w-full mt-4 py-2 text-slate-400 text-sm hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
