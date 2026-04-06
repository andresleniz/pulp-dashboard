'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import TopNav from '@/components/layout/TopNav'
import DecisionLayer from '@/components/dashboard/DecisionLayer'
import PriceEvolutionChart from '@/components/dashboard/PriceEvolutionChart'
import CompetitorComparisonChart from '@/components/dashboard/CompetitorComparisonChart'
import VolumeTrendChart from '@/components/dashboard/VolumeTrendChart'
import ExpertInsightsPanel from '@/components/dashboard/ExpertInsightsPanel'
import NewsFeedPanel from '@/components/dashboard/NewsFeedPanel'
import CustomerTable from '@/components/dashboard/CustomerTable'
import MeetingNotesPanel from '@/components/dashboard/MeetingNotesPanel'
import MarketSignalsPanel from '@/components/dashboard/MarketSignalsPanel'
import AIMarketIntelligencePanel from '@/components/ai/AIMarketIntelligencePanel'
import AIAnalysisPanel from '@/components/ai/AIAnalysisPanel'
import ScenarioSimulator from '@/components/simulator/ScenarioSimulator'
import TrafficLight from '@/components/ui/TrafficLight'
import type {
  Market, Grade, Order, CompetitorPrice, ExpertInsight, MarketNews,
  MeetingNote, Customer, Contract, PricingRecommendation, SentimentScore, ExportData,
} from '@/types'
import clsx from 'clsx'

type Section = 'decision' | 'charts' | 'intelligence' | 'ai' | 'customers' | 'notes' | 'simulator'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'decision', label: 'Pricing Decision' },
  { id: 'charts', label: 'Price & Volume' },
  { id: 'intelligence', label: 'Market Intel' },
  { id: 'ai', label: 'AI Intelligence' },
  { id: 'customers', label: 'Customers' },
  { id: 'notes', label: 'Meeting Notes' },
  { id: 'simulator', label: 'Scenarios' },
]

export default function MarketDashboardPage() {
  const params = useParams()
  const marketId = parseInt(params.marketId as string)

  // Core data
  const [market, setMarket] = useState<Market | null>(null)
  const [grades, setGrades] = useState<Grade[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [competitorPrices, setCompetitorPrices] = useState<CompetitorPrice[]>([])
  const [expertInsights, setExpertInsights] = useState<ExpertInsight[]>([])
  const [marketNews, setMarketNews] = useState<MarketNews[]>([])
  const [meetingNotes, setMeetingNotes] = useState<MeetingNote[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])

  // Pricing engine output
  const [recommendations, setRecommendations] = useState<PricingRecommendation[]>([])
  const [sentimentScore, setSentimentScore] = useState<SentimentScore | null>(null)

  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<Section>('decision')
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        marketsRes, gradesRes, ordersRes, compRes,
        expertRes, newsRes, notesRes, customersRes,
        contractsRes, pricingRes,
      ] = await Promise.all([
        fetch('/api/markets'),
        fetch('/api/grades'),
        fetch(`/api/orders?marketId=${marketId}&months=6`),
        fetch(`/api/competitor-prices?marketId=${marketId}`),
        fetch(`/api/expert-insights?marketId=${marketId}`),
        fetch(`/api/market-news?marketId=${marketId}`),
        fetch(`/api/meeting-notes?marketId=${marketId}`),
        fetch(`/api/customers?marketId=${marketId}`),
        fetch(`/api/contracts?marketId=${marketId}`),
        fetch(`/api/pricing/${marketId}`),
      ])

      const [
        marketsData, gradesData, ordersData, compData,
        expertData, newsData, notesData, customersData,
        contractsData, pricingData,
      ] = await Promise.all([
        marketsRes.json() as Promise<Market[]>,
        gradesRes.json() as Promise<Grade[]>,
        ordersRes.json() as Promise<Order[]>,
        compRes.json() as Promise<CompetitorPrice[]>,
        expertRes.json() as Promise<ExpertInsight[]>,
        newsRes.json() as Promise<MarketNews[]>,
        notesRes.json() as Promise<MeetingNote[]>,
        customersRes.json() as Promise<Customer[]>,
        contractsRes.json() as Promise<Contract[]>,
        pricingRes.json() as Promise<{ recommendations: PricingRecommendation[]; sentimentScore: SentimentScore }>,
      ])

      const foundMarket = marketsData.find((m: Market) => m.id === marketId) || null
      setMarket(foundMarket)
      setGrades(gradesData)
      setOrders(Array.isArray(ordersData) ? ordersData : [])
      setCompetitorPrices(Array.isArray(compData) ? compData : [])
      setExpertInsights(Array.isArray(expertData) ? expertData : [])
      setMarketNews(Array.isArray(newsData) ? newsData : [])
      setMeetingNotes(Array.isArray(notesData) ? notesData : [])
      setCustomers(Array.isArray(customersData) ? customersData : [])
      setContracts(Array.isArray(contractsData) ? contractsData : [])
      setRecommendations(pricingData.recommendations || [])
      setSentimentScore(pricingData.sentimentScore || null)

      if (!selectedGradeId && pricingData.recommendations?.length > 0) {
        setSelectedGradeId(pricingData.recommendations[0].gradeId)
      }
    } catch (err) {
      console.error('Market dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }, [marketId, selectedGradeId])

  useEffect(() => {
    loadData()
  }, [marketId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNoteAdded = (note: MeetingNote) => {
    setMeetingNotes(prev => [note, ...prev])
    // Re-fetch pricing so the new note's sentiment immediately affects recommendations
    loadData()
  }

  // Derived metrics for simulator
  const activeRec = recommendations.find(r => r.gradeId === selectedGradeId) || recommendations[0]
  const totalMonthlyVolume = orders.reduce((s, o) => s + o.volume, 0) / 6 // avg over 6 months
  const currentAvgPriceAll = recommendations.length > 0
    ? Math.round(recommendations.reduce((s, r) => s + r.currentAvgPrice, 0) / recommendations.length)
    : 0

  const sentimentLight = sentimentScore?.overall === 'bullish' ? 'green'
    : sentimentScore?.overall === 'bearish' ? 'red' : 'yellow'

  const hasConflict = recommendations.some(r =>
    r.riskFlags.some(rf => rf.toLowerCase().includes('conflict'))
  )

  const exportData: ExportData = {
    recommendations,
    sentimentScore,
    orders,
    competitorPrices,
    customers,
    marketName: market?.name,
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <TopNav breadcrumb={['Markets', 'Loading...']} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 text-slate-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading market data...
          </div>
        </div>
      </div>
    )
  }

  if (!market) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <TopNav breadcrumb={['Markets', 'Not Found']} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-slate-400">Market not found.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopNav
        breadcrumb={['Markets', market.name]}
        marketId={market.id}
        marketName={market.name}
        exportData={exportData}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Market Header */}
        <div className="bg-slate-900 border-b border-slate-700 px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-white">{market.name}</h1>
                  {market.benchmark_flag && (
                    <span className="text-xs text-amber-400 bg-amber-900/30 border border-amber-700/30 px-2 py-0.5 rounded-full">
                      Benchmark Market
                    </span>
                  )}
                  <span className="text-xs text-slate-500 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
                    {market.region}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {customers.length} customers · {orders.length} orders (6mo) · {recommendations.length} grades priced
                </div>
              </div>
            </div>

            {/* Market KPIs */}
            <div className="flex items-center gap-6">
              {sentimentScore && (
                <div className="flex items-center gap-2">
                  <TrafficLight status={sentimentLight} size="sm" />
                  <div>
                    <div className="text-xs text-slate-500">Sentiment</div>
                    <div className={clsx(
                      'text-sm font-semibold capitalize',
                      sentimentScore.overall === 'bullish' ? 'text-emerald-400' :
                      sentimentScore.overall === 'bearish' ? 'text-red-400' : 'text-yellow-400'
                    )}>
                      {sentimentScore.overall}
                    </div>
                  </div>
                </div>
              )}
              {currentAvgPriceAll > 0 && (
                <div>
                  <div className="text-xs text-slate-500">Avg Price</div>
                  <div className="text-sm font-bold text-white">${currentAvgPriceAll}/t</div>
                </div>
              )}
              {activeRec && (
                <div>
                  <div className="text-xs text-slate-500">Confidence</div>
                  <div className={clsx(
                    'text-sm font-bold',
                    activeRec.confidenceScore >= 70 ? 'text-emerald-400' :
                    activeRec.confidenceScore >= 40 ? 'text-yellow-400' : 'text-red-400'
                  )}>
                    {activeRec.confidenceScore}%
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section Navigation */}
          <div className="flex items-center gap-1 mt-4 overflow-x-auto">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={clsx(
                  'px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors',
                  activeSection === s.id
                    ? 'bg-brand-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">

          {/* ═══ LAYER 1: PRICING DECISION ═══ */}
          {activeSection === 'decision' && (
            <>
              {hasConflict && (
                <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-700/40 rounded-lg px-4 py-3">
                  <svg className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <div>
                    <div className="text-sm font-semibold text-amber-400">Field intelligence contradicts pricing model</div>
                    <div className="text-xs text-amber-300/70 mt-0.5">
                      Meeting notes signal a direction opposite to the model recommendation. Review the Notes tab and adjust manually if field data is more current.
                    </div>
                  </div>
                </div>
              )}
              <DecisionLayer
                recommendations={recommendations}
                grades={grades}
                marketName={market.name}
              />

              {/* Sentiment breakdown below decision */}
              {sentimentScore && (
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'News Sentiment', score: sentimentScore.sources.news, icon: '📰' },
                    { label: 'Expert Forecast', score: sentimentScore.sources.expert, icon: '🎯' },
                    { label: 'Meeting Notes', score: sentimentScore.sources.meetingNotes, icon: '📝' },
                  ].map(item => {
                    const normalized = Math.max(0, Math.min(100, (item.score + 1) * 50))
                    const status: 'green' | 'yellow' | 'red' =
                      item.score > 0.2 ? 'green' : item.score < -0.2 ? 'red' : 'yellow'
                    return (
                      <div key={item.label} className="card-dark flex items-center gap-4">
                        <div className="flex flex-col items-center gap-2">
                          <TrafficLight status={status} size="md" />
                          <span className="text-lg">{item.icon}</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-slate-500 mb-1">{item.label}</div>
                          <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={clsx(
                                'h-full rounded-full transition-all',
                                status === 'green' ? 'bg-emerald-500' :
                                status === 'red' ? 'bg-red-500' : 'bg-yellow-500'
                              )}
                              style={{ width: `${normalized}%` }}
                            />
                          </div>
                          <div className={clsx(
                            'text-xs font-medium mt-1',
                            status === 'green' ? 'text-emerald-400' :
                            status === 'red' ? 'text-red-400' : 'text-yellow-400'
                          )}>
                            {item.score > 0.2 ? 'Bullish' : item.score < -0.2 ? 'Bearish' : 'Neutral'}
                            <span className="text-slate-600 ml-1">({item.score.toFixed(2)})</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ═══ LAYER 2: PRICE & VOLUME CHARTS ═══ */}
          {activeSection === 'charts' && (
            <>
              {/* Grade filter */}
              {grades.length > 1 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">Filter by grade:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedGradeId(null)}
                      className={clsx(
                        'px-3 py-1.5 text-xs rounded-lg border transition-colors',
                        selectedGradeId === null
                          ? 'bg-brand-600 border-brand-500 text-white'
                          : 'border-slate-600 text-slate-400 hover:text-white hover:border-slate-500'
                      )}
                    >
                      All Grades
                    </button>
                    {grades.map(g => (
                      <button
                        key={g.id}
                        onClick={() => setSelectedGradeId(g.id)}
                        className={clsx(
                          'px-3 py-1.5 text-xs rounded-lg border transition-colors',
                          selectedGradeId === g.id
                            ? 'bg-brand-600 border-brand-500 text-white'
                            : 'border-slate-600 text-slate-400 hover:text-white hover:border-slate-500'
                        )}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <PriceEvolutionChart
                orders={orders}
                competitorPrices={competitorPrices}
                expertInsights={expertInsights}
                gradeId={selectedGradeId ?? undefined}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CompetitorComparisonChart
                  orders={orders}
                  competitorPrices={competitorPrices}
                  gradeId={selectedGradeId ?? undefined}
                />
                <VolumeTrendChart
                  orders={orders}
                  contracts={contracts}
                  customers={customers}
                />
              </div>
            </>
          )}

          {/* ═══ LAYER 3: MARKET INTELLIGENCE ═══ */}
          {activeSection === 'intelligence' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <ExpertInsightsPanel
                  insights={expertInsights}
                  grades={grades}
                  currentAvgPrice={currentAvgPriceAll}
                />
              </div>
              <div className="space-y-6">
                <NewsFeedPanel news={marketNews} />
                {/* Industry Events summary */}
                <div className="card-dark">
                  <div className="text-sm font-semibold text-white mb-3">Data Source Coverage</div>
                  <div className="space-y-2">
                    {[
                      { label: 'Competitor price records', count: competitorPrices.length, icon: '📊', threshold: 3 },
                      { label: 'Expert forecasts', count: expertInsights.length, icon: '🎯', threshold: 2 },
                      { label: 'News articles', count: marketNews.length, icon: '📰', threshold: 3 },
                      { label: 'Meeting notes', count: meetingNotes.length, icon: '📝', threshold: 2 },
                      { label: 'Orders (6mo)', count: orders.length, icon: '📋', threshold: 10 },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </div>
                        <span className={clsx(
                          'text-xs font-semibold px-2 py-0.5 rounded-full',
                          item.count >= item.threshold
                            ? 'bg-emerald-900/40 text-emerald-400'
                            : item.count > 0
                              ? 'bg-yellow-900/40 text-yellow-400'
                              : 'bg-red-900/40 text-red-400'
                        )}>
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
                    Coverage affects the confidence score. Aim for green across all sources.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ LAYER 4: AI MARKET INTELLIGENCE ═══ */}
          {activeSection === 'ai' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AIMarketIntelligencePanel
                marketId={marketId}
                marketName={market.name}
                sentimentScore={sentimentScore}
                recommendation={activeRec ?? null}
                onReviewComplete={loadData}
              />
              <div className="space-y-4">
                <div className="card-dark">
                  <div className="text-sm font-semibold text-white mb-1">Analyze New Text</div>
                  <div className="text-xs text-slate-500 mb-4">
                    Paste market news, expert report excerpts, or internal notes for AI extraction.
                  </div>
                  <AIAnalysisPanel
                    marketId={marketId}
                    defaultSourceType="market_news"
                    onSaved={loadData}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ═══ LAYER 5: CUSTOMERS ═══ */}
          {activeSection === 'customers' && (
            <CustomerTable
              customers={customers}
              orders={orders}
              contracts={contracts}
              grades={grades}
              marketAvgPrice={currentAvgPriceAll}
            />
          )}

          {/* ═══ LAYER 6: MEETING NOTES + SIGNALS ═══ */}
          {activeSection === 'notes' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MeetingNotesPanel
                notes={meetingNotes}
                market={market}
                customers={customers}
                onNoteAdded={handleNoteAdded}
                onAISignalSaved={loadData}
              />
              <MarketSignalsPanel notes={meetingNotes} />
            </div>
          )}

          {/* ═══ LAYER 7: SCENARIO SIMULATOR ═══ */}
          {activeSection === 'simulator' && (
            <>
              {activeRec ? (
                <ScenarioSimulator
                  currentPrice={activeRec.currentAvgPrice || activeRec.priceMid}
                  currentVolume={Math.round(totalMonthlyVolume) || 5000}
                  currentMargin={Math.round((activeRec.priceMid - 700) * 0.35)}
                />
              ) : (
                <div className="card-dark text-center py-12 text-slate-500">
                  No pricing data available for scenario simulation. Add orders first.
                </div>
              )}

              {/* Grade selector for simulator */}
              {recommendations.length > 1 && (
                <div className="card-dark">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">
                    Simulate by Grade
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {recommendations.map(rec => (
                      <button
                        key={rec.gradeId}
                        onClick={() => setSelectedGradeId(rec.gradeId)}
                        className={clsx(
                          'px-4 py-2 rounded-lg text-sm border transition-colors',
                          selectedGradeId === rec.gradeId
                            ? 'bg-brand-600 border-brand-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                        )}
                      >
                        <div className="font-medium">{rec.gradeName}</div>
                        <div className="text-xs opacity-70">${rec.currentAvgPrice}/t · {rec.confidenceScore}% conf</div>
                      </button>
                    ))}
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
