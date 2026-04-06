'use client'

import { useState, useCallback, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import {
  parseCSVText, processRows, normaliseHeader,
  type ParseResult, type ColumnMap, FIELD_LABELS,
} from '@/lib/ingestionService'
import type { Market, Grade } from '@/types'
import clsx from 'clsx'

interface CsvUploadPanelProps {
  markets: Market[]
  grades:  Grade[]
}

interface RawData {
  rows:    Record<string, unknown>[]
  headers: string[]
}

const FIELD_ORDER: (keyof ColumnMap)[] = [
  'year', 'month', 'date', 'volume', 'net_price',
  'list_price', 'customer_name', 'grade_name', 'market', 'rebates', 'discounts',
]

export default function CsvUploadPanel({ markets, grades }: CsvUploadPanelProps) {
  const [selectedMarketId, setSelectedMarketId] = useState<string>('')
  const [rawData, setRawData]                   = useState<RawData | null>(null)
  const [columnOverride, setColumnOverride]     = useState<Partial<ColumnMap>>({})
  const [fileName, setFileName]                 = useState<string>('')
  const [uploading, setUploading]               = useState(false)
  const [showHeaders, setShowHeaders]           = useState(false)

  // Re-run full pipeline whenever rawData, overrides, or market selection changes
  const parseResult: ParseResult | null = useMemo(() => {
    if (!rawData) return null
    const fallback = selectedMarketId ? parseInt(selectedMarketId) : undefined
    return processRows(rawData.rows, rawData.headers, fallback, columnOverride)
  }, [rawData, columnOverride, selectedMarketId])

  const parseFile = useCallback((file: File) => {
    setFileName(file.name)
    setColumnOverride({})
    const name = file.name.toLowerCase()

    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data    = new Uint8Array(e.target?.result as ArrayBuffer)
          // cellDates:true converts Excel date serials to JS Date objects
          const wb      = XLSX.read(data, { type: 'array', cellDates: true })
          const ws      = wb.Sheets[wb.SheetNames[0]]
          const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
            defval: '',
            raw: true,
          })
          const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : []
          setRawData({ rows: rawRows, headers })
        } catch {
          toast.error('Failed to parse XLSX file')
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const { rows, headers } = parseCSVText(e.target?.result as string)
          setRawData({ rows, headers })
        } catch {
          toast.error('Failed to parse CSV file')
        }
      }
      reader.readAsText(file)
    }
  }, [])

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0]
    if (!file) return
    parseFile(file)
  }, [parseFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
  })

  const handleOverride = (field: keyof ColumnMap, value: string) => {
    setColumnOverride(prev => {
      const next = { ...prev }
      if (value === '') {
        delete next[field]
      } else {
        next[field] = value
      }
      return next
    })
  }

  const handleUpload = async () => {
    if (!selectedMarketId) { toast.error('Select a market before uploading'); return }
    if (!parseResult || parseResult.validRows.length === 0) { toast.error('No valid rows to upload'); return }

    setUploading(true)
    try {
      const marketId = parseInt(selectedMarketId)
      const payload  = parseResult.validRows.map(row => ({
        year:       row.year!,
        month:      row.month!,
        volume:     row.volume    ?? 0,
        list_price: row.list_price ?? 0,
        net_price:  row.net_price  ?? 0,
        rebates:    row.rebates    ?? 0,
        discounts:  row.discounts  ?? 0,
        market_id:  row.market_id ?? marketId,
        ...(row.grade_name    ? { grade_name:    row.grade_name }
          : row.grade_id      ? { grade_id:      row.grade_id }
          : { grade_name: grades[0]?.name ?? 'EKP' }),
        ...(row.customer_name ? { customer_name: row.customer_name }
          : row.customer_id   ? { customer_id:   row.customer_id }
          : {}),
      }))

      const res  = await fetch('/api/orders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const data = await res.json() as { inserted: number }
      toast.success(`${data.inserted} orders uploaded`)
      setRawData(null)
      setColumnOverride({})
      setFileName('')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Upload card ─────────────────────────────────────────────────── */}
      <div className="card-dark">
        <h3 className="text-sm font-semibold text-white mb-1">Orders Upload (CSV / XLSX)</h3>
        <p className="text-xs text-slate-400 mb-4">
          Flexible column detection — any recognizable header variant is accepted.
          Use the mapping panel to fix any mis-detected columns before uploading.
        </p>

        {/* Market selector */}
        <div className="mb-4">
          <label className="text-xs text-slate-400 block mb-1.5">Market context *</label>
          <select
            value={selectedMarketId}
            onChange={e => setSelectedMarketId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select market for this upload...</option>
            {markets.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={clsx(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
            isDragActive
              ? 'border-brand-500 bg-brand-900/20'
              : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div className={clsx(
              'w-12 h-12 rounded-full flex items-center justify-center',
              isDragActive ? 'bg-brand-900/40' : 'bg-slate-700'
            )}>
              <svg className={clsx('w-6 h-6', isDragActive ? 'text-brand-400' : 'text-slate-400')}
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            {fileName ? (
              <div>
                <div className="text-sm font-medium text-white">{fileName}</div>
                {parseResult && (
                  <div className="text-xs text-slate-400 mt-1">
                    {parseResult.rows.length} rows · {parseResult.validRows.length} valid · {parseResult.invalidRows.length} invalid
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="text-sm text-slate-300">
                  {isDragActive ? 'Drop file here' : 'Drag & drop CSV or XLSX, or click to browse'}
                </div>
                <div className="text-xs text-slate-500 mt-1">.csv and .xlsx supported</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Raw header debug panel ──────────────────────────────────────── */}
      {rawData && rawData.headers.length > 0 && (
        <div className="card-dark">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setShowHeaders(h => !h)}
          >
            <span className="text-sm font-semibold text-white">
              Raw File Headers ({rawData.headers.length})
            </span>
            <span className="text-xs text-slate-500">{showHeaders ? '▲ hide' : '▼ show'}</span>
          </button>

          {showHeaders && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700">
                    <th className="text-left pb-1.5 pr-4">#</th>
                    <th className="text-left pb-1.5 pr-4">Original header</th>
                    <th className="text-left pb-1.5">Normalised (what matching uses)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rawData.headers.map((h, i) => (
                    <tr key={i}>
                      <td className="py-1 pr-4 text-slate-600">{i + 1}</td>
                      <td className="py-1 pr-4 font-mono text-slate-300">{h}</td>
                      <td className="py-1 font-mono text-slate-500">{normaliseHeader(h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Column mapping + override panel ────────────────────────────── */}
      {parseResult && rawData && (
        <div className="card-dark">
          <div className="text-sm font-semibold text-white mb-1">Column Mapping</div>
          <p className="text-xs text-slate-500 mb-3">
            Auto-detected mappings shown below. Use the dropdown to fix any wrong or missing assignments.
          </p>

          <div className="space-y-1.5">
            {FIELD_ORDER.map(field => {
              const meta      = FIELD_LABELS[field]
              const detected  = parseResult.columnMap[field]    // what auto-detect found (may include override)
              const isOverridden = !!columnOverride[field]

              return (
                <div key={field} className={clsx(
                  'grid grid-cols-[140px_1fr] gap-3 items-center px-2.5 py-1.5 rounded text-xs',
                  detected
                    ? isOverridden ? 'bg-amber-900/20' : 'bg-slate-800'
                    : meta.required ? 'bg-red-900/25' : 'bg-slate-900'
                )}>
                  {/* Label */}
                  <span className={clsx('font-medium', meta.required ? 'text-white' : 'text-slate-400')}>
                    {meta.label}
                    {meta.required && <span className="text-red-400 ml-0.5">*</span>}
                  </span>

                  {/* Dropdown override */}
                  <select
                    value={columnOverride[field] ?? detected ?? ''}
                    onChange={e => handleOverride(field, e.target.value)}
                    className={clsx(
                      'w-full bg-slate-700 border text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500',
                      detected ? 'border-slate-600 text-slate-200' : 'border-red-700/50 text-slate-400'
                    )}
                  >
                    <option value="">— not mapped —</option>
                    {rawData.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>

          {Object.keys(columnOverride).length > 0 && (
            <button
              onClick={() => setColumnOverride({})}
              className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Reset all overrides
            </button>
          )}

          {parseResult.warnings.length > 0 && (
            <div className="mt-3 p-2 bg-yellow-900/20 rounded text-xs text-yellow-400">
              {parseResult.warnings.slice(0, 3).join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* ── Row preview ─────────────────────────────────────────────────── */}
      {parseResult && (
        <div className="card-dark">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-white">Preview (first 10 rows)</div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-emerald-400">{parseResult.validRows.length} valid</span>
              {parseResult.invalidRows.length > 0 && (
                <span className="text-red-400">{parseResult.invalidRows.length} errors</span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700">
                  <th className="text-left pb-2 pr-3">OK</th>
                  <th className="text-left pb-2 pr-3">Customer</th>
                  <th className="text-left pb-2 pr-3">Grade</th>
                  <th className="text-right pb-2 pr-3">Year</th>
                  <th className="text-right pb-2 pr-3">Mo</th>
                  <th className="text-right pb-2 pr-3">Volume</th>
                  <th className="text-right pb-2 pr-3">Net Price</th>
                  <th className="text-left pb-2">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {parseResult.rows.slice(0, 10).map((row, i) => {
                  const inv   = parseResult.invalidRows.find(ir => ir.row === row)
                  const valid = !inv
                  return (
                    <tr key={i} className={valid ? '' : 'bg-red-900/10'}>
                      <td className="py-2 pr-3">
                        {valid
                          ? <span className="text-emerald-400">✓</span>
                          : <span className="text-red-400">✗</span>}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {row.customer_name || (row.customer_id ? `ID:${row.customer_id}` : '—')}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {row.grade_name || (row.grade_id ? `ID:${row.grade_id}` : '—')}
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-300">{row.year ?? '—'}</td>
                      <td className="py-2 pr-3 text-right text-slate-300">{row.month ?? '—'}</td>
                      <td className="py-2 pr-3 text-right text-slate-300">
                        {row.volume?.toLocaleString() ?? '—'}
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-300">
                        {row.net_price !== undefined ? `$${row.net_price.toFixed(0)}` : '—'}
                      </td>
                      <td className="py-2 text-red-400 max-w-xs truncate">
                        {inv?.errors.slice(0, 2).join(' · ')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => { setRawData(null); setColumnOverride({}); setFileName('') }}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || parseResult.validRows.length === 0 || !selectedMarketId}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {uploading ? 'Uploading...' : `Upload ${parseResult.validRows.length} Orders`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
