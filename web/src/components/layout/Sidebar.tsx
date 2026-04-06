'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import type { Market } from '@/types'
import clsx from 'clsx'

interface SidebarProps {
  markets?: Market[]
}

export default function Sidebar({ markets = [] }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [fetchedMarkets, setFetchedMarkets] = useState<Market[]>(markets)

  useEffect(() => {
    if (markets.length === 0) {
      fetch('/api/markets')
        .then(r => r.json())
        .then(data => setFetchedMarkets(data))
        .catch(() => {})
    }
  }, [markets])

  const allMarkets = markets.length > 0 ? markets : fetchedMarkets

  const navItems = [
    {
      href: '/',
      label: 'Global Overview',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      href: '/data-ingestion',
      label: 'Data Ingestion',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      ),
    },
  ]

  return (
    <aside
      className={clsx(
        'flex flex-col bg-slate-900 border-r border-slate-700 transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <div>
              <div className="text-white font-semibold text-sm">Pulp Intel</div>
              <div className="text-slate-500 text-xs">Pricing Intelligence</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center mx-auto">
            <span className="text-white font-bold text-sm">P</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-white transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="space-y-1 px-2">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                pathname === item.href
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
              title={collapsed ? item.label : undefined}
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </div>

        {/* Markets Section */}
        {!collapsed && (
          <div className="mt-6 px-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Markets
            </div>
            <div className="space-y-0.5">
              {allMarkets.map(market => {
                const isActive = pathname === `/markets/${market.id}`
                return (
                  <Link
                    key={market.id}
                    href={`/markets/${market.id}`}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    )}
                  >
                    <div className={clsx(
                      'w-2 h-2 rounded-full',
                      market.benchmark_flag ? 'bg-amber-400' : 'bg-slate-500'
                    )} />
                    <span className="truncate">{market.name}</span>
                    {market.benchmark_flag && (
                      <span className="text-xs text-amber-500 ml-auto">BM</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {collapsed && (
          <div className="mt-4 px-2 space-y-0.5">
            {allMarkets.map(market => (
              <Link
                key={market.id}
                href={`/markets/${market.id}`}
                title={market.name}
                className={clsx(
                  'flex items-center justify-center w-10 h-10 rounded-lg mx-auto transition-colors',
                  pathname === `/markets/${market.id}`
                    ? 'bg-brand-600/20 text-brand-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}
              >
                <span className="text-xs font-semibold">{market.name.substring(0, 2).toUpperCase()}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        {!collapsed && (
          <div className="text-xs text-slate-600 text-center">
            Pulp Intel v1.0
          </div>
        )}
      </div>
    </aside>
  )
}
