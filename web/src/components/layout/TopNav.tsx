'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import ExportPanel from '@/components/ui/ExportPanel'
import type { ExportData } from '@/types'

interface TopNavProps {
  breadcrumb?: string[]
  marketId?: number
  marketName?: string
  exportData?: ExportData
}

export default function TopNav({ breadcrumb = [], marketId, marketName, exportData }: TopNavProps) {
  const [showExport, setShowExport] = useState(false)
  const today = format(new Date(), 'MMMM d, yyyy')

  return (
    <>
      <header className="h-14 border-b border-slate-700 bg-slate-900/80 backdrop-blur flex items-center justify-between px-6 shrink-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Pulp Intel</span>
          {breadcrumb.map((crumb, idx) => (
            <span key={idx} className="flex items-center gap-2">
              <svg className="w-3 h-3 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span className={idx === breadcrumb.length - 1 ? 'text-white font-medium' : 'text-slate-400'}>
                {crumb}
              </span>
            </span>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{today}</span>
          </div>

          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-sm rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </header>

      {showExport && (
        <ExportPanel
          marketId={marketId}
          marketName={marketName}
          {...exportData}
          onClose={() => setShowExport(false)}
        />
      )}
    </>
  )
}
