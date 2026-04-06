import { subMonths, subDays, format } from 'date-fns'
import type {
  Market, Grade, Customer, Order, Contract,
  CompetitorPrice, MarketNews, ExpertInsight,
  Event, MeetingNote,
} from '@/types'

const now = new Date(2026, 2, 30) // March 30, 2026

export const mockMarkets: Market[] = [
  { id: 1, name: 'China', region: 'Asia', benchmark_flag: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 2, name: 'Europe', region: 'Europe', benchmark_flag: false, created_at: '2024-01-01T00:00:00Z' },
  { id: 3, name: 'North America', region: 'Americas', benchmark_flag: false, created_at: '2024-01-01T00:00:00Z' },
  { id: 4, name: 'LATAM', region: 'Americas', benchmark_flag: false, created_at: '2024-01-01T00:00:00Z' },
  { id: 5, name: 'Asia Pacific', region: 'Asia Pacific', benchmark_flag: false, created_at: '2024-01-01T00:00:00Z' },
]

export const mockGrades: Grade[] = [
  { id: 1, name: 'EKP', created_at: '2024-01-01T00:00:00Z' },
  { id: 2, name: 'BKP', created_at: '2024-01-01T00:00:00Z' },
  { id: 3, name: 'UKP Paper', created_at: '2024-01-01T00:00:00Z' },
  { id: 4, name: 'UKP Fiber Cement', created_at: '2024-01-01T00:00:00Z' },
]

export const mockCustomers: Customer[] = [
  { id: 1, name: 'Shandong Sun Paper', market_id: 1, created_at: '2024-01-01T00:00:00Z' },
  { id: 2, name: 'Nine Dragons Paper', market_id: 1, created_at: '2024-01-01T00:00:00Z' },
  { id: 3, name: 'APP China', market_id: 1, created_at: '2024-01-01T00:00:00Z' },
  { id: 4, name: 'Sappi Europe', market_id: 2, created_at: '2024-01-01T00:00:00Z' },
  { id: 5, name: 'UPM-Kymmene', market_id: 2, created_at: '2024-01-01T00:00:00Z' },
  { id: 6, name: 'Stora Enso Trading', market_id: 2, created_at: '2024-01-01T00:00:00Z' },
  { id: 7, name: 'Domtar Corporation', market_id: 3, created_at: '2024-01-01T00:00:00Z' },
  { id: 8, name: 'Resolute Forest Products', market_id: 3, created_at: '2024-01-01T00:00:00Z' },
  { id: 9, name: 'CMPC Celulosa', market_id: 4, created_at: '2024-01-01T00:00:00Z' },
  { id: 10, name: 'Fibria Trading', market_id: 4, created_at: '2024-01-01T00:00:00Z' },
  { id: 11, name: 'Nippon Paper Industries', market_id: 5, created_at: '2024-01-01T00:00:00Z' },
  { id: 12, name: 'Oji Holdings', market_id: 5, created_at: '2024-01-01T00:00:00Z' },
]

export const mockContracts: Contract[] = [
  { id: 1, customer_id: 1, yearly_volume: 60000, pricing_type: 'indexed', created_at: '2024-01-01T00:00:00Z' },
  { id: 2, customer_id: 2, yearly_volume: 48000, pricing_type: 'negotiated', created_at: '2024-01-01T00:00:00Z' },
  { id: 3, customer_id: 3, yearly_volume: 36000, pricing_type: 'indexed', created_at: '2024-01-01T00:00:00Z' },
  { id: 4, customer_id: 4, yearly_volume: 30000, pricing_type: 'negotiated', created_at: '2024-01-01T00:00:00Z' },
  { id: 5, customer_id: 5, yearly_volume: 24000, pricing_type: 'indexed', created_at: '2024-01-01T00:00:00Z' },
  { id: 6, customer_id: 6, yearly_volume: 18000, pricing_type: 'negotiated', created_at: '2024-01-01T00:00:00Z' },
  { id: 7, customer_id: 7, yearly_volume: 20000, pricing_type: 'negotiated', created_at: '2024-01-01T00:00:00Z' },
  { id: 8, customer_id: 8, yearly_volume: 15000, pricing_type: 'indexed', created_at: '2024-01-01T00:00:00Z' },
  { id: 9, customer_id: 9, yearly_volume: 12000, pricing_type: 'negotiated', created_at: '2024-01-01T00:00:00Z' },
  { id: 10, customer_id: 10, yearly_volume: 10000, pricing_type: 'indexed', created_at: '2024-01-01T00:00:00Z' },
  { id: 11, customer_id: 11, yearly_volume: 22000, pricing_type: 'indexed', created_at: '2024-01-01T00:00:00Z' },
  { id: 12, customer_id: 12, yearly_volume: 18000, pricing_type: 'negotiated', created_at: '2024-01-01T00:00:00Z' },
]

// Customer -> grade mapping for realistic orders
const customerGradeMap: Record<number, number> = {
  1: 1, 2: 1, 3: 2, // China: EKP, EKP, BKP
  4: 1, 5: 2, 6: 3, // Europe: EKP, BKP, UKP Paper
  7: 3, 8: 4,       // NA: UKP Paper, UKP Fiber Cement
  9: 2, 10: 2,       // LATAM: BKP
  11: 1, 12: 3,      // AsiaPac: EKP, UKP Paper
}

// Base prices per grade
const gradeBasePrices: Record<number, number> = {
  1: 1100, // EKP
  2: 1000, // BKP
  3: 900,  // UKP Paper
  4: 850,  // UKP Fiber Cement
}

// Market-specific price adjustments
const marketPriceAdjust: Record<number, number> = {
  1: 15,   // China: premium
  2: 5,    // Europe: slight premium
  3: -10,  // NA: slight discount
  4: -20,  // LATAM: discount
  5: 10,   // AsiaPac: moderate premium
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Generate 6 months of orders
export const mockOrders: Order[] = (() => {
  const orders: Order[] = []
  let id = 1
  for (const customer of mockCustomers) {
    const gradeId = customerGradeMap[customer.id] || 1
    const basePrice = gradeBasePrices[gradeId]
    const mktAdj = marketPriceAdjust[customer.market_id] || 0

    for (let m = 5; m >= 0; m--) {
      const orderDate = subMonths(now, m)
      const seed = customer.id * 100 + m
      const volumeBase = 500 + seededRandom(seed) * 4500
      const volume = Math.round(volumeBase / 100) * 100

      // Trend: China going up, LATAM going down slightly
      let trendAdj = 0
      if (customer.market_id === 1) trendAdj = m * -5 // getting higher as m decreases (more recent)
      if (customer.market_id === 4) trendAdj = m * 8   // higher in past, lower now

      const listPrice = basePrice + mktAdj + trendAdj + (seededRandom(seed + 1) * 20 - 10)
      const netPrice = listPrice * (0.88 + seededRandom(seed + 2) * 0.08)
      const rebates = listPrice * (0.03 + seededRandom(seed + 3) * 0.04)
      const discounts = listPrice * (0.01 + seededRandom(seed + 4) * 0.03)

      const orderYear  = orderDate.getFullYear()
      const orderMonth = orderDate.getMonth() + 1
      orders.push({
        id: id++,
        customer_id: customer.id,
        grade_id: gradeId,
        year: orderYear,
        month: orderMonth,
        date: `${orderYear}-${String(orderMonth).padStart(2, '0')}-01`,
        volume: Math.round(volume),
        list_price: Math.round(listPrice * 100) / 100,
        net_price: Math.round(netPrice * 100) / 100,
        rebates: Math.round(rebates * 100) / 100,
        discounts: Math.round(discounts * 100) / 100,
        created_at: format(orderDate, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      })
    }
  }
  return orders
})()

// Competitor prices - last 3 months
export const mockCompetitorPrices: CompetitorPrice[] = (() => {
  const prices: CompetitorPrice[] = []
  let id = 1
  const competitors = ['Suzano', 'CMPC', 'Fibria', 'Mercer International']
  for (const market of mockMarkets) {
    for (const grade of mockGrades) {
      const basePrice = gradeBasePrices[grade.id]
      const mktAdj = marketPriceAdjust[market.id] || 0
      for (let m = 2; m >= 0; m--) {
        const date = subMonths(now, m)
        const seed = market.id * 50 + grade.id * 10 + m
        const price = basePrice + mktAdj + (seededRandom(seed) * 60 - 30)
        const source = competitors[Math.floor(seededRandom(seed + 5) * competitors.length)]
        prices.push({
          id: id++,
          market_id: market.id,
          grade_id: grade.id,
          price: Math.round(price * 100) / 100,
          date: format(date, 'yyyy-MM-dd'),
          source,
          created_at: format(date, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
        })
      }
    }
  }
  return prices
})()

export const mockExpertInsights: ExpertInsight[] = [
  {
    id: 1, source: 'RISI', market_id: 1, grade_id: 1,
    price_forecast_low: 1080, price_forecast_high: 1140,
    sentiment: 'bullish', date: format(subDays(now, 5), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 5), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 2, source: 'TTO', market_id: 1, grade_id: 2,
    price_forecast_low: 970, price_forecast_high: 1030,
    sentiment: 'bullish', date: format(subDays(now, 3), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 3), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 3, source: 'RISI', market_id: 2, grade_id: 1,
    price_forecast_low: 1050, price_forecast_high: 1110,
    sentiment: 'neutral', date: format(subDays(now, 7), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 7), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 4, source: 'TTO', market_id: 2, grade_id: 2,
    price_forecast_low: 940, price_forecast_high: 1000,
    sentiment: 'neutral', date: format(subDays(now, 6), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 6), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 5, source: 'RISI', market_id: 3, grade_id: 3,
    price_forecast_low: 870, price_forecast_high: 930,
    sentiment: 'bearish', date: format(subDays(now, 4), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 4), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 6, source: 'TTO', market_id: 4, grade_id: 2,
    price_forecast_low: 960, price_forecast_high: 1020,
    sentiment: 'bullish', date: format(subDays(now, 8), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 8), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  // North America — additional grades
  {
    id: 7, source: 'RISI', market_id: 3, grade_id: 4,
    price_forecast_low: 820, price_forecast_high: 875,
    sentiment: 'bearish', date: format(subDays(now, 6), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 6), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 8, source: 'TTO', market_id: 3, grade_id: 1,
    price_forecast_low: 1050, price_forecast_high: 1100,
    sentiment: 'neutral', date: format(subDays(now, 9), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 9), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  // LATAM — additional grades
  {
    id: 9, source: 'RISI', market_id: 4, grade_id: 1,
    price_forecast_low: 1060, price_forecast_high: 1120,
    sentiment: 'bullish', date: format(subDays(now, 5), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 5), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  // Asia Pacific — full coverage
  {
    id: 10, source: 'RISI', market_id: 5, grade_id: 1,
    price_forecast_low: 1090, price_forecast_high: 1155,
    sentiment: 'bullish', date: format(subDays(now, 4), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 4), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 11, source: 'TTO', market_id: 5, grade_id: 3,
    price_forecast_low: 880, price_forecast_high: 945,
    sentiment: 'neutral', date: format(subDays(now, 7), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 7), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  // China — UKP grades
  {
    id: 12, source: 'RISI', market_id: 1, grade_id: 3,
    price_forecast_low: 890, price_forecast_high: 950,
    sentiment: 'neutral', date: format(subDays(now, 6), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 6), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 13, source: 'TTO', market_id: 1, grade_id: 4,
    price_forecast_low: 840, price_forecast_high: 900,
    sentiment: 'bearish', date: format(subDays(now, 4), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 4), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  // Europe — additional grades
  {
    id: 14, source: 'RISI', market_id: 2, grade_id: 3,
    price_forecast_low: 875, price_forecast_high: 935,
    sentiment: 'neutral', date: format(subDays(now, 5), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 5), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
]

export const mockMarketNews: MarketNews[] = [
  {
    id: 1, market_id: 1,
    title: 'Chinese paper mills increase pulp orders ahead of Q4',
    summary: 'Major Chinese paper mills have significantly increased their pulp procurement, citing strong demand from packaging and tissue sectors. Buying momentum expected to continue through Q3.',
    sentiment: 'bullish', date: format(subDays(now, 2), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 2), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 2, market_id: 1,
    title: 'China real estate slowdown weighs on fiber cement demand',
    summary: 'Ongoing challenges in the Chinese real estate sector continue to suppress demand for fiber cement grade pulp products. Analysts expect this headwind to persist through H2.',
    sentiment: 'bearish', date: format(subDays(now, 5), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 5), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 3, market_id: 2,
    title: 'European tissue producers report stable demand',
    summary: 'European tissue manufacturers report steady demand conditions, maintaining current procurement volumes into Q3. No major disruptions anticipated.',
    sentiment: 'neutral', date: format(subDays(now, 3), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 3), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 4, market_id: 2,
    title: 'Energy costs stabilize, supporting European mill operations',
    summary: 'After 18 months of elevated energy costs, European pulp and paper mills are seeing relief as energy prices stabilize, improving operational margins and competitiveness.',
    sentiment: 'bullish', date: format(subDays(now, 7), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 7), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 5, market_id: 3,
    title: 'US printing and writing paper demand remains soft',
    summary: 'North American P&W segment continues to see structural decline, with some offset from packaging grades showing modest growth. Oversupply conditions persist.',
    sentiment: 'bearish', date: format(subDays(now, 4), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 4), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 6, market_id: 3,
    title: 'Capacity curtailments support North American pulp prices',
    summary: 'Several North American mills have announced temporary curtailments, tightening supply and providing upward price support in an otherwise soft market.',
    sentiment: 'bullish', date: format(subDays(now, 10), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 10), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 7, market_id: 4,
    title: 'LATAM packaging demand drives BKP uptake',
    summary: 'Strong growth in e-commerce and food packaging across Latin America is supporting demand for bleached kraft pulp. Brazil and Mexico lead in volume growth.',
    sentiment: 'bullish', date: format(subDays(now, 6), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 6), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 8, market_id: 4,
    title: 'Currency depreciation pressures LATAM buyers',
    summary: 'Weakening local currencies in key LATAM markets are creating pricing headwinds as buyers face higher USD-denominated costs, squeezing margins for regional converters.',
    sentiment: 'bearish', date: format(subDays(now, 9), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 9), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 9, market_id: 5,
    title: 'Japanese paper sector stabilizes after Q2 weakness',
    summary: 'After a difficult Q2 characterized by inventory destocking, Japanese paper mills are gradually returning to normal procurement patterns. Recovery pace remains cautious.',
    sentiment: 'neutral', date: format(subDays(now, 8), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 8), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 10, market_id: 5,
    title: 'Southeast Asian packaging boom drives pulp demand',
    summary: 'Rapidly expanding middle class and e-commerce growth in Southeast Asia is creating sustained demand for packaging-grade pulp. Indonesia and Vietnam leading the growth.',
    sentiment: 'bullish', date: format(subDays(now, 12), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 12), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
]

export const mockMeetingNotes: MeetingNote[] = [
  {
    id: 1, market_id: 1, customer_id: 1,
    date: format(subDays(now, 2), 'yyyy-MM-dd'),
    source_type: 'customer_meeting',
    raw_text: 'Met with procurement director at Shandong Sun Paper. They confirmed strong demand for Q3 and expressed price acceptance for the upcoming quarter. Mentioned competitors are also increasing prices, especially Suzano raised their offer by $30. Supply remains tight in the market. Customer is willing to increase volume by 10% if we can guarantee stable supply.',
    extracted_sentiment: 'bullish',
    extracted_signals: ['price_mention', 'competitor_increasing', 'tight_supply', 'demand_shift'],
    tags: ['customer', 'price_pressure', 'demand'],
    created_at: format(subDays(now, 2), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 2, market_id: 1, customer_id: 2,
    date: format(subDays(now, 5), 'yyyy-MM-dd'),
    source_type: 'customer_meeting',
    raw_text: 'Discussion with Nine Dragons trading team. They indicated some price resistance at current levels for EKP grade. Customer mentioned high inventory levels from previous quarter. They are reducing volume commitments by approximately 15% in Q3. Competitor APP is offering significant discounts to maintain volumes.',
    extracted_sentiment: 'bearish',
    extracted_signals: ['price_resistance', 'competitor_mention'],
    tags: ['customer', 'competitor'],
    created_at: format(subDays(now, 5), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 3, market_id: 2, customer_id: 4,
    date: format(subDays(now, 4), 'yyyy-MM-dd'),
    source_type: 'agent_call',
    raw_text: 'Call with our European agent covering Sappi account. Sappi reports stable demand from their tissue and packaging operations. No strong signals either way. They mentioned UPM has been offering competitive pricing but nothing aggressive. Market appears balanced with no major supply disruptions anticipated.',
    extracted_sentiment: 'neutral',
    extracted_signals: ['competitor_mention', 'price_mention'],
    tags: ['customer', 'competitor'],
    created_at: format(subDays(now, 4), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 4, market_id: 3, customer_id: null,
    date: format(subDays(now, 7), 'yyyy-MM-dd'),
    source_type: 'internal_meeting',
    raw_text: 'Internal strategy review for North America market. P&W segment continues to decline structurally. However, packaging grades showing interesting growth. We discussed whether to pivot allocation toward packaging customers. Competitive pressure from Canadian producers is intense. No room for price increases in the short term. Consider maintaining current pricing to protect volume.',
    extracted_sentiment: 'bearish',
    extracted_signals: ['price_resistance', 'competitor_mention'],
    tags: ['price_pressure', 'supply_issue'],
    created_at: format(subDays(now, 7), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 5, market_id: 5, customer_id: 11,
    date: format(subDays(now, 3), 'yyyy-MM-dd'),
    source_type: 'customer_meeting',
    raw_text: 'Visit to Nippon Paper headquarters in Tokyo. Management reports that destocking phase is complete and they are returning to normal procurement levels. Strong demand from packaging division. They anticipate increasing orders by 20% in Q4. Capacity at their Hokkaido mill is running at 92% utilization. Price increase accepted without major pushback.',
    extracted_sentiment: 'bullish',
    extracted_signals: ['demand_shift', 'tight_supply'],
    tags: ['customer', 'demand'],
    created_at: format(subDays(now, 3), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  // Europe — bearish field note (creates conflict test with bullish Europe news)
  {
    id: 6, market_id: 2, customer_id: 5,
    date: format(subDays(now, 1), 'yyyy-MM-dd'),
    source_type: 'agent_call',
    raw_text: 'UPM-Kymmene trading team reports high inventory levels and is reducing volume commitments significantly. They mentioned weak demand from their customers and heavy discount pressure from Asian competitors. Structural decline in printing grades is accelerating. We should not expect volume increases here. Oversupply conditions persist.',
    extracted_sentiment: 'bearish',
    extracted_signals: ['price_resistance', 'competitor_mention', 'demand_shift'],
    tags: ['customer', 'competitor', 'price_pressure'],
    created_at: format(subDays(now, 1), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  // LATAM — bullish field note (creates conflict with neutral/bearish LATAM signals)
  {
    id: 7, market_id: 4, customer_id: 9,
    date: format(subDays(now, 2), 'yyyy-MM-dd'),
    source_type: 'customer_meeting',
    raw_text: 'CMPC procurement team confirmed strong demand outlook for Q4. Growing demand from e-commerce packaging. They are willing to increase volume commitments and showed price acceptance for increases. Supply constraints from Arauco outage supporting tight supply conditions. Competitor Fibria also increasing prices this month.',
    extracted_sentiment: 'bullish',
    extracted_signals: ['demand_shift', 'tight_supply', 'competitor_increasing', 'price_mention'],
    tags: ['customer', 'demand', 'supply_issue'],
    created_at: format(subDays(now, 2), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  // Asia Pacific — second note
  {
    id: 8, market_id: 5, customer_id: 12,
    date: format(subDays(now, 6), 'yyyy-MM-dd'),
    source_type: 'customer_meeting',
    raw_text: 'Meeting with Oji Holdings trading team. Strong demand from packaging sector across Southeast Asia. Competitor APP raising prices by $25/ton this quarter. Customer indicated they have no room for significant price increases beyond APP levels but growing demand supports volume increases.',
    extracted_sentiment: 'bullish',
    extracted_signals: ['competitor_increasing', 'demand_shift', 'price_mention'],
    tags: ['customer', 'competitor', 'demand'],
    created_at: format(subDays(now, 6), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  // North America — additional bearish note
  {
    id: 9, market_id: 3, customer_id: null,
    date: format(subDays(now, 5), 'yyyy-MM-dd'),
    source_type: 'internal_meeting',
    raw_text: 'Internal review confirms structural decline in NA printing and writing segment. Competitive pressure from Canadian producers is intense with significant discounts offered. Customer reducing orders across all grades. No room for price increases in Q4. Oversupply conditions expected to persist through year-end. Recommend maintaining pricing to protect volume.',
    extracted_sentiment: 'bearish',
    extracted_signals: ['price_resistance', 'competitor_mention', 'demand_shift'],
    tags: ['price_pressure', 'competitor'],
    created_at: format(subDays(now, 5), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
]

// Pinned reference date — used by pricing engine in mock mode so time windows
// stay stable relative to the mock data rather than drifting with real time.
export const MOCK_NOW = now

export const mockEvents: Event[] = [
  {
    id: 1, type: 'outage', company: 'Resolute Forest Products',
    description: 'Planned maintenance outage at Bowater mill reducing capacity by 80,000 ADMT for 3 weeks',
    date: format(subDays(now, 14), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 14), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 2, type: 'price_increase', company: 'Suzano',
    description: 'Suzano announced $30/ton list price increase effective next month for hardwood grades',
    date: format(subDays(now, 7), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 7), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 3, type: 'capacity', company: 'APP Indonesia',
    description: 'APP announces 200,000 ton/year capacity expansion, commissioning scheduled for Q2 next year',
    date: format(subDays(now, 30), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 30), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 4, type: 'price_increase', company: 'CMPC',
    description: 'CMPC raises softwood pulp prices by $20/ton in European market citing logistic cost increases',
    date: format(subDays(now, 5), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 5), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
  {
    id: 5, type: 'outage', company: 'Mercer International',
    description: 'Force majeure declared at Celgar mill following equipment failure; 60,000 ADMT impacted',
    date: format(subDays(now, 3), 'yyyy-MM-dd'),
    created_at: format(subDays(now, 3), "yyyy-MM-dd'T'HH:mm:ss'Z'"),
  },
]
