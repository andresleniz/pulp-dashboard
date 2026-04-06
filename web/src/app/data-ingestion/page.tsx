'use client'

import { useEffect, useState } from 'react'
import TopNav from '@/components/layout/TopNav'
import CsvUploadPanel from '@/components/ingestion/CsvUploadPanel'
import CompetitorPriceForm from '@/components/ingestion/CompetitorPriceForm'
import ExpertInsightForm from '@/components/ingestion/ExpertInsightForm'
import MarketNewsForm from '@/components/ingestion/MarketNewsForm'
import type { Market, Grade } from '@/types'
import clsx from 'clsx'

type Tab = 'crm' | 'competitor' | 'expert' | 'news' | 'scrapers'

const TABS: { id: Tab; label: string; description: string; icon: React.ReactNode }[] = [
  {
    id: 'crm',
    label: 'CRM Orders',
    description: 'Upload order data from your CRM system',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    id: 'competitor',
    label: 'Competitor Prices',
    description: 'Manually enter observed competitor prices',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'expert',
    label: 'Expert Insights',
    description: 'Record RISI / TTO / other forecast data',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    id: 'news',
    label: 'Market News',
    description: 'Log news and market intelligence signals',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    ),
  },
  {
    id: 'scrapers',
    label: 'Scrapers',
    description: 'Automated data source connectors (scaffold)',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

interface ScraperConfig {
  name: string
  source: string
  status: 'configured' | 'pending' | 'disabled'
  description: string
  dataType: string
  frequency: string
}

const SCRAPERS: ScraperConfig[] = [
  {
    name: 'TTO Price Index',
    source: 'TTO',
    status: 'pending',
    description: 'Technical Trade Organization — weekly pulp price indices by grade and region.',
    dataType: 'Competitor prices + expert forecasts',
    frequency: 'Weekly',
  },
  {
    name: 'RISI / Fastmarkets',
    source: 'RISI',
    status: 'pending',
    description: 'Fastmarkets RISI — global forest product market intelligence and pricing.',
    dataType: 'Expert insights + price forecasts',
    frequency: 'Monthly',
  },
  {
    name: 'Pulp & Paper Week',
    source: 'P&PW',
    status: 'disabled',
    description: 'Industry trade publication — news, capacity announcements, mill outages.',
    dataType: 'Market news + events',
    frequency: 'Weekly',
  },
  {
    name: 'FOEX Indices',
    source: 'FOEX',
    status: 'pending',
    description: 'FOEX benchmark indices for BHKP and NBSK markets.',
    dataType: 'Benchmark prices',
    frequency: 'Weekly',
  },
  {
    name: 'ChinaPulp.net',
    source: 'ChinaPulp',
    status: 'disabled',
    description: 'China-specific pulp market news and price signals.',
    dataType: 'China market news',
    frequency: 'Daily',
  },
]

export default function DataIngestionPage() {
  const [activeTab, setActiveTab] = useState<Tab>('crm')
  const [markets, setMarkets] = useState<Market[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/markets').then(r => r.json()),
      fetch('/api/grades').then(r => r.json()),
    ]).then(([mData, gData]) => {
      setMarkets(mData as Market[])
      setGrades(gData as Grade[])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopNav breadcrumb={['Data Ingestion']} />

      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-700 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">Data Ingestion</h1>
              <p className="text-sm text-slate-400 mt-1">
                Feed the pricing engine — every input improves recommendation accuracy and confidence scores.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-700/30 rounded-lg px-3 py-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              Data persisted — inputs affect recommendations
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm whitespace-nowrap transition-colors',
                  activeTab === tab.id
                    ? 'bg-brand-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          ) : (
            <>
              {/* CRM Orders */}
              {activeTab === 'crm' && (
                <div className="space-y-6 max-w-3xl">
                  <div className="bg-brand-900/20 border border-brand-700/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-sm text-brand-200">
                        <div className="font-medium mb-1">How CRM data improves pricing</div>
                        <div className="text-brand-300 text-xs leading-relaxed">
                          Order history drives the baseline price calculation, volume trend detection, and customer allocation analysis.
                          Upload the last 3–6 months of orders for best results. The engine uses <strong>net prices</strong> (after rebates and discounts) as its primary signal.
                        </div>
                      </div>
                    </div>
                  </div>
                  <CsvUploadPanel markets={markets} grades={grades} />
                </div>
              )}

              {/* Competitor Prices */}
              {activeTab === 'competitor' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <CompetitorPriceForm markets={markets} grades={grades} />

                    {/* Why it matters */}
                    <div className="space-y-4">
                      <div className="card-dark">
                        <div className="text-sm font-semibold text-white mb-3">Why Competitor Prices Matter</div>
                        <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
                          <p>
                            Competitor prices directly set the <strong className="text-white">baseline</strong> used by the pricing engine.
                            Without competitor data, the engine defaults to your own net price history only.
                          </p>
                          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs">
                            <div className="text-slate-300 font-medium mb-2">Engine formula (simplified):</div>
                            <code className="text-brand-300">
                              baseline = avg(last_month_net_price, competitor_price)
                            </code>
                            <div className="text-slate-500 mt-1">
                              If no competitor data → baseline = your price only
                            </div>
                          </div>
                          <p>
                            A <strong className="text-white">&quot;competitor increasing&quot;</strong> signal in meeting notes raises the low band.
                            Actual competitor price data constrains the high band.
                          </p>
                        </div>
                      </div>

                      <div className="card-dark">
                        <div className="text-sm font-semibold text-white mb-3">Key Competitors by Market</div>
                        <div className="space-y-2 text-xs">
                          {[
                            { market: 'China', competitors: ['Suzano', 'Eldorado Brasil', 'APRIL'] },
                            { market: 'Europe', competitors: ['Metsä Fibre', 'UPM', 'Sappi'] },
                            { market: 'North America', competitors: ['Canfor', 'West Fraser', 'Resolute'] },
                            { market: 'LATAM', competitors: ['CMPC', 'Fibria (Suzano)', 'Arauco'] },
                            { market: 'Asia Pacific', competitors: ['APP', 'APRIL', 'Oji'] },
                          ].map(item => (
                            <div key={item.market} className="flex items-start gap-3">
                              <span className="text-brand-400 font-medium w-24 shrink-0">{item.market}</span>
                              <span className="text-slate-500">{item.competitors.join(' · ')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Expert Insights */}
              {activeTab === 'expert' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ExpertInsightForm markets={markets} grades={grades} />

                  <div className="space-y-4">
                    <div className="card-dark">
                      <div className="text-sm font-semibold text-white mb-3">How Forecasts Are Used</div>
                      <div className="space-y-2 text-xs text-slate-400 leading-relaxed">
                        <p>Expert forecasts provide the <strong className="text-white">price ceiling and floor</strong> for the recommendation band.</p>
                        <div className="space-y-1.5 mt-2">
                          {[
                            { rule: 'Price below expert low range', action: '→ engine pushes upward', color: 'text-emerald-400' },
                            { rule: 'Price above expert high range', action: '→ engine constrains recommendation', color: 'text-red-400' },
                            { rule: 'Bullish expert sentiment (+40% weight)', action: '→ adjustment bias up', color: 'text-emerald-400' },
                            { rule: 'Bearish expert sentiment (+40% weight)', action: '→ adjustment bias down', color: 'text-red-400' },
                          ].map(item => (
                            <div key={item.rule} className="flex items-start gap-2">
                              <span className="text-slate-500 shrink-0 mt-0.5">▸</span>
                              <div>
                                <span className="text-slate-300">{item.rule}</span>
                                <span className={`ml-1 ${item.color}`}>{item.action}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 p-2 bg-brand-900/20 border border-brand-700/20 rounded-lg">
                          <div className="text-brand-300 font-medium mb-1">Confidence boost</div>
                          <div className="text-brand-400">
                            Each expert insight with a price range adds +15 points to the confidence score.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="card-dark">
                      <div className="text-sm font-semibold text-white mb-2">Recommended Sources</div>
                      <div className="space-y-2">
                        {[
                          { name: 'RISI / Fastmarkets', freq: 'Monthly', type: 'Price forecast' },
                          { name: 'TTO (ABTCP)', freq: 'Monthly', type: 'Price index + forecast' },
                          { name: 'FOEX BHKP/NBSK', freq: 'Weekly', type: 'Benchmark index' },
                          { name: 'Wood Mackenzie', freq: 'Quarterly', type: 'Long-range forecast' },
                        ].map(s => (
                          <div key={s.name} className="flex items-center justify-between text-xs bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                            <span className="text-slate-300 font-medium">{s.name}</span>
                            <div className="flex items-center gap-3 text-slate-500">
                              <span>{s.type}</span>
                              <span className="text-slate-600">·</span>
                              <span>{s.freq}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Market News */}
              {activeTab === 'news' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <MarketNewsForm markets={markets} />

                  <div className="space-y-4">
                    <div className="card-dark">
                      <div className="text-sm font-semibold text-white mb-3">News Sentiment Weighting</div>
                      <div className="text-xs text-slate-400 leading-relaxed space-y-2">
                        <p>News items contribute <strong className="text-white">30%</strong> of the overall composite sentiment score. Expert forecasts contribute 40%, meeting notes 30%.</p>
                        <div className="mt-3 space-y-1.5">
                          {[
                            { signal: 'Capacity outage / mill closure', effect: 'Bullish → supply tightening', color: 'text-emerald-400' },
                            { signal: 'New capacity announced', effect: 'Bearish → future supply increase', color: 'text-red-400' },
                            { signal: 'Strong demand from China', effect: 'Bullish → price pressure up', color: 'text-emerald-400' },
                            { signal: 'High inventory at mills', effect: 'Bearish → demand softening', color: 'text-red-400' },
                            { signal: 'Currency moves (BRL/USD)', effect: 'Context-dependent', color: 'text-yellow-400' },
                          ].map(item => (
                            <div key={item.signal} className="flex items-start gap-2">
                              <span className="text-slate-500 shrink-0 mt-0.5">▸</span>
                              <div>
                                <span className="text-slate-300">{item.signal}</span>
                                <span className={`block ${item.color}`}>{item.effect}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="card-dark">
                      <div className="text-sm font-semibold text-white mb-2">Tip: Use Meeting Notes Instead</div>
                      <div className="text-xs text-slate-400 leading-relaxed">
                        For qualitative intelligence (customer calls, agent reports), use the <strong className="text-white">Meeting Notes</strong> panel inside each Market Dashboard.
                        It has richer signal extraction and directly feeds the pricing override layer.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Scrapers */}
              {activeTab === 'scrapers' && (
                <div className="space-y-6 max-w-3xl">
                  <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 17c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <div>
                        <div className="text-sm font-medium text-yellow-300 mb-1">Scraper Infrastructure — Scaffold Only</div>
                        <div className="text-xs text-yellow-400/70 leading-relaxed">
                          These connectors are scaffolded but not implemented. They define the structure for automated data ingestion.
                          Real scraping requires API agreements with data providers or custom parsers for each source.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {SCRAPERS.map(scraper => (
                      <div
                        key={scraper.name}
                        className="card-dark"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-sm font-semibold text-white">{scraper.name}</span>
                              <span className={clsx(
                                'text-xs px-2 py-0.5 rounded-full border font-medium',
                                scraper.status === 'configured'
                                  ? 'bg-emerald-900/40 text-emerald-400 border-emerald-700/50'
                                  : scraper.status === 'pending'
                                    ? 'bg-yellow-900/40 text-yellow-400 border-yellow-700/50'
                                    : 'bg-slate-700 text-slate-500 border-slate-600'
                              )}>
                                {scraper.status === 'configured' ? 'Active'
                                  : scraper.status === 'pending' ? 'Needs Config'
                                  : 'Disabled'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mb-2">{scraper.description}</p>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              <span>Data: <span className="text-slate-400">{scraper.dataType}</span></span>
                              <span>Frequency: <span className="text-slate-400">{scraper.frequency}</span></span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 shrink-0">
                            <button
                              disabled
                              className="px-3 py-1.5 text-xs bg-slate-700 text-slate-500 rounded-lg border border-slate-600 cursor-not-allowed"
                              title="Scraper integration not implemented in this version"
                            >
                              Configure
                            </button>
                            <button
                              disabled
                              className="px-3 py-1.5 text-xs bg-slate-700 text-slate-500 rounded-lg border border-slate-600 cursor-not-allowed"
                              title="Scraper integration not implemented in this version"
                            >
                              Run Now
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Implementation guide */}
                  <div className="card-dark">
                    <div className="text-sm font-semibold text-white mb-3">Implementation Guide</div>
                    <div className="space-y-3 text-xs text-slate-400">
                      <p>To implement real scrapers, create service modules in <code className="text-brand-300">src/lib/scrapers/</code>:</p>
                      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 font-mono text-xs text-slate-300 space-y-1">
                        <div><span className="text-slate-500">// src/lib/scrapers/</span></div>
                        <div>ttoScraper.ts        <span className="text-slate-500">// TTO price parser</span></div>
                        <div>risiScraper.ts       <span className="text-slate-500">// RISI/Fastmarkets API client</span></div>
                        <div>foexScraper.ts       <span className="text-slate-500">// FOEX index fetcher</span></div>
                        <div>newsScraper.ts       <span className="text-slate-500">// RSS feed aggregator</span></div>
                        <div>index.ts             <span className="text-slate-500">// Scheduler + orchestrator</span></div>
                      </div>
                      <p>Each scraper should normalize output into the <code className="text-brand-300">CompetitorPrice</code> or <code className="text-brand-300">ExpertInsight</code> schema and POST to the existing API routes.</p>
                      <p>Schedule using a cron job (e.g., <code className="text-brand-300">node-cron</code>) or an external scheduler calling <code className="text-brand-300">/api/scraper/[source]</code>.</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
