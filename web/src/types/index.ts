export interface Market {
  id: number
  name: string
  region: string
  benchmark_flag: boolean
  created_at: string
}

export interface Grade {
  id: number
  name: string
  created_at: string
}

export interface Customer {
  id: number
  name: string
  market_id: number
  created_at: string
}

export interface Order {
  id: number
  customer_id: number
  grade_id: number
  year: number   // allocation year (e.g. 2026)
  month: number  // allocation month 1–12
  date: string   // derived display key: `${year}-${MM}-01` — used by charts
  volume: number
  list_price: number
  net_price: number
  rebates: number
  discounts: number
  created_at: string
}

export interface Contract {
  id: number
  customer_id: number
  yearly_volume: number
  pricing_type: 'indexed' | 'negotiated'
  created_at: string
}

export interface CompetitorPrice {
  id: number
  market_id: number
  grade_id: number
  price: number
  date: string
  source: string
  created_at: string
}

export interface MarketNews {
  id: number
  market_id: number
  title: string
  summary: string
  sentiment: 'bullish' | 'neutral' | 'bearish'
  date: string
  created_at: string
}

export interface ExpertInsight {
  id: number
  source: string
  market_id: number
  grade_id: number
  price_forecast_low: number
  price_forecast_high: number
  sentiment: 'bullish' | 'neutral' | 'bearish'
  date: string
  created_at: string
}

export interface Event {
  id: number
  type: 'outage' | 'price_increase' | 'capacity'
  company: string
  description: string
  date: string
  created_at: string
}

export interface ManualInput {
  id: number
  type: 'notes' | 'meeting_insights'
  content: string
  market_id: number
  date: string
  created_at: string
}

export interface MeetingNote {
  id: number
  market_id: number
  customer_id: number | null
  date: string
  source_type: 'customer_meeting' | 'internal_meeting' | 'agent_call'
  raw_text: string
  extracted_sentiment: 'bullish' | 'neutral' | 'bearish'
  extracted_signals: string[]
  tags: string[]
  created_at: string
}

export interface PricingRecommendation {
  marketId: number
  gradeId: number
  gradeName: string
  priceLow: number
  priceMid: number
  priceHigh: number
  currentAvgPrice: number
  confidenceScore: number
  expectedVolumeImpact: number
  expectedMarginImpact: number
  topDrivers: string[]
  riskFlags: string[]
  priceband: 'low' | 'mid' | 'high'
  reasoning: string
}

export interface SentimentScore {
  overall: 'bullish' | 'neutral' | 'bearish'
  score: number
  sources: {
    news: number
    expert: number
    meetingNotes: number
  }
}

export interface ScenarioResult {
  priceChangePct: number
  elasticity: number
  expectedVolume: number
  expectedMargin: number
  currentVolume: number
  currentPrice: number
  expectedRevenue: number
  expectedVolumeChangePct: number
  expectedMarginChangePct: number
  expectedRevenueChangePct: number
}

export interface MarketSummary {
  market: Market
  currentAvgPrice: number
  recommendedPrice: number
  pricePressure: 'up' | 'flat' | 'down'
  sentiment: 'bullish' | 'neutral' | 'bearish'
  confidence: number
  recommendations: PricingRecommendation[]
}

export interface CustomerSummary {
  customer: Customer
  grade: Grade | null
  monthlyVolume: number
  contractMonthlyTarget: number
  volumeVsContract: number
  avgNetPrice: number
  marketAvgPrice: number
  priceVsMarket: number
  churnRisk: 'High' | 'Medium' | 'Low'
  volumeTrend: number
}

export interface OrderWithDetails extends Order {
  customer_name?: string
  grade_name?: string
  market_id?: number
}

export interface ExportData {
  recommendations: PricingRecommendation[]
  sentimentScore: SentimentScore | null
  orders: Order[]
  competitorPrices: CompetitorPrice[]
  customers?: Customer[]
  marketName?: string
}

// Re-export AI types so components can import from '@/types'
export type { AnalyzedText, AISignalsInput, ExtractedSignal, ReviewStatus } from '@/lib/ai/aiSchemas'
