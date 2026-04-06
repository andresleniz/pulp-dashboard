import { Pool } from 'pg'
import { subMonths, subDays, format, addDays } from 'date-fns'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/pulp_pricing',
})

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Markets
    const marketsRes = await client.query(
      `INSERT INTO markets (name, region, benchmark_flag) VALUES
        ('China', 'Asia', true),
        ('Europe', 'Europe', false),
        ('North America', 'Americas', false),
        ('LATAM', 'Americas', false),
        ('Asia Pacific', 'Asia Pacific', false)
      ON CONFLICT DO NOTHING RETURNING id, name`
    )
    const marketMap: Record<string, number> = {}
    const marketRows = await client.query('SELECT id, name FROM markets')
    for (const row of marketRows.rows) {
      marketMap[row.name] = row.id
    }

    // Grades
    await client.query(
      `INSERT INTO grades (name) VALUES
        ('EKP'), ('BKP'), ('UKP Paper'), ('UKP Fiber Cement')
      ON CONFLICT DO NOTHING`
    )
    const gradeRows = await client.query('SELECT id, name FROM grades')
    const gradeMap: Record<string, number> = {}
    for (const row of gradeRows.rows) {
      gradeMap[row.name] = row.id
    }

    // Customers
    const customersData = [
      { name: 'Shandong Sun Paper', market: 'China' },
      { name: 'Nine Dragons Paper', market: 'China' },
      { name: 'APP China', market: 'China' },
      { name: 'Sappi Europe', market: 'Europe' },
      { name: 'UPM-Kymmene', market: 'Europe' },
      { name: 'Stora Enso Trading', market: 'Europe' },
      { name: 'Domtar Corporation', market: 'North America' },
      { name: 'Resolute Forest Products', market: 'North America' },
      { name: 'CMPC Celulosa', market: 'LATAM' },
      { name: 'Fibria Trading', market: 'LATAM' },
      { name: 'Nippon Paper Industries', market: 'Asia Pacific' },
      { name: 'Oji Holdings', market: 'Asia Pacific' },
    ]

    const customerMap: Record<string, number> = {}
    for (const c of customersData) {
      const res = await client.query(
        `INSERT INTO customers (name, market_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING id`,
        [c.name, marketMap[c.market]]
      )
      if (res.rows.length > 0) {
        customerMap[c.name] = res.rows[0].id
      }
    }
    const allCustomers = await client.query('SELECT id, name FROM customers')
    for (const row of allCustomers.rows) {
      customerMap[row.name] = row.id
    }

    // Contracts
    const contractData = [
      { customer: 'Shandong Sun Paper', volume: 60000, type: 'indexed' },
      { customer: 'Nine Dragons Paper', volume: 48000, type: 'negotiated' },
      { customer: 'APP China', volume: 36000, type: 'indexed' },
      { customer: 'Sappi Europe', volume: 30000, type: 'negotiated' },
      { customer: 'UPM-Kymmene', volume: 24000, type: 'indexed' },
      { customer: 'Stora Enso Trading', volume: 18000, type: 'negotiated' },
      { customer: 'Domtar Corporation', volume: 20000, type: 'negotiated' },
      { customer: 'Resolute Forest Products', volume: 15000, type: 'indexed' },
      { customer: 'CMPC Celulosa', volume: 12000, type: 'negotiated' },
      { customer: 'Fibria Trading', volume: 10000, type: 'indexed' },
      { customer: 'Nippon Paper Industries', volume: 22000, type: 'indexed' },
      { customer: 'Oji Holdings', volume: 18000, type: 'negotiated' },
    ]

    for (const c of contractData) {
      const cid = customerMap[c.customer]
      if (cid) {
        await client.query(
          `INSERT INTO contracts (customer_id, yearly_volume, pricing_type) VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [cid, c.volume, c.type]
        )
      }
    }

    // Price ranges per grade
    const gradePrices: Record<string, { base: number; range: number }> = {
      'EKP': { base: 1100, range: 50 },
      'BKP': { base: 1000, range: 50 },
      'UKP Paper': { base: 900, range: 50 },
      'UKP Fiber Cement': { base: 850, range: 50 },
    }

    // Orders - 6 months
    const gradeNames = ['EKP', 'BKP', 'UKP Paper', 'UKP Fiber Cement']
    const now = new Date()
    for (const customer of customersData) {
      const cid = customerMap[customer.name]
      if (!cid) continue
      const primaryGrade = gradeNames[Math.floor(Math.random() * gradeNames.length)]
      const gid = gradeMap[primaryGrade]
      const gp = gradePrices[primaryGrade]

      for (let m = 5; m >= 0; m--) {
        const orderDate = subMonths(now, m)
        const baseVol = 500 + Math.random() * 4500
        const volume = Math.round(baseVol / 100) * 100
        const listPrice = gp.base + gp.range + Math.random() * 20 - 10
        const netPrice = listPrice * (0.88 + Math.random() * 0.08)
        const rebates = listPrice * (0.03 + Math.random() * 0.04)
        const discounts = listPrice * (0.01 + Math.random() * 0.03)

        await client.query(
          `INSERT INTO orders (customer_id, grade_id, date, volume, list_price, net_price, rebates, discounts)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            cid,
            gid,
            format(orderDate, 'yyyy-MM-dd'),
            volume,
            Math.round(listPrice * 100) / 100,
            Math.round(netPrice * 100) / 100,
            Math.round(rebates * 100) / 100,
            Math.round(discounts * 100) / 100,
          ]
        )
      }
    }

    // Competitor prices - 3 months
    const competitors = ['Suzano', 'CMPC', 'Fibria', 'Mercer International']
    for (const marketName of Object.keys(marketMap)) {
      for (const gradeName of gradeNames) {
        const gp = gradePrices[gradeName]
        for (let m = 2; m >= 0; m--) {
          const date = subMonths(now, m)
          const price = gp.base + (Math.random() * 60 - 30)
          const source = competitors[Math.floor(Math.random() * competitors.length)]
          await client.query(
            `INSERT INTO competitor_prices (market_id, grade_id, price, date, source)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              marketMap[marketName],
              gradeMap[gradeName],
              Math.round(price * 100) / 100,
              format(date, 'yyyy-MM-dd'),
              source,
            ]
          )
        }
      }
    }

    // Market news
    const newsItems = [
      { market: 'China', title: 'Chinese paper mills increase pulp orders ahead of Q4', summary: 'Major Chinese paper mills have significantly increased their pulp procurement, citing strong demand from packaging and tissue sectors.', sentiment: 'bullish', daysAgo: 2 },
      { market: 'China', title: 'China real estate slowdown weighs on fiber cement demand', summary: 'Ongoing challenges in the Chinese real estate sector continue to suppress demand for fiber cement grade pulp products.', sentiment: 'bearish', daysAgo: 5 },
      { market: 'Europe', title: 'European tissue producers report stable demand', summary: 'European tissue manufacturers report steady demand conditions, maintaining current procurement volumes into Q3.', sentiment: 'neutral', daysAgo: 3 },
      { market: 'Europe', title: 'Energy costs stabilize, supporting European mill operations', summary: 'After 18 months of elevated energy costs, European pulp and paper mills are seeing relief as energy prices stabilize, improving margins.', sentiment: 'bullish', daysAgo: 7 },
      { market: 'North America', title: 'US printing and writing paper demand remains soft', summary: 'North American P&W segment continues to see structural decline, with some offset from packaging grades showing modest growth.', sentiment: 'bearish', daysAgo: 4 },
      { market: 'North America', title: 'Capacity curtailments support North American pulp prices', summary: 'Several North American mills have announced temporary curtailments, tightening supply and providing upward price support.', sentiment: 'bullish', daysAgo: 10 },
      { market: 'LATAM', title: 'LATAM packaging demand drives BKP uptake', summary: 'Strong growth in e-commerce and food packaging across Latin America is supporting demand for bleached kraft pulp.', sentiment: 'bullish', daysAgo: 6 },
      { market: 'LATAM', title: 'Currency depreciation pressures LATAM buyers', summary: 'Weakening local currencies in key LATAM markets are creating pricing headwinds as buyers face higher USD-denominated costs.', sentiment: 'bearish', daysAgo: 9 },
      { market: 'Asia Pacific', title: 'Japanese paper sector stabilizes after Q2 weakness', summary: 'After a difficult Q2 characterized by inventory destocking, Japanese paper mills are gradually returning to normal procurement patterns.', sentiment: 'neutral', daysAgo: 8 },
      { market: 'Asia Pacific', title: 'Southeast Asian packaging boom drives pulp demand', summary: 'Rapidly expanding middle class and e-commerce growth in Southeast Asia is creating sustained demand for packaging-grade pulp.', sentiment: 'bullish', daysAgo: 12 },
    ]

    for (const news of newsItems) {
      await client.query(
        `INSERT INTO market_news (market_id, title, summary, sentiment, date)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          marketMap[news.market],
          news.title,
          news.summary,
          news.sentiment,
          format(subDays(now, news.daysAgo), 'yyyy-MM-dd'),
        ]
      )
    }

    // Expert insights
    const expertData = [
      { source: 'RISI', market: 'China', grade: 'EKP', low: 1080, high: 1140, sentiment: 'bullish', daysAgo: 5 },
      { source: 'TTO', market: 'China', grade: 'BKP', low: 970, high: 1030, sentiment: 'bullish', daysAgo: 3 },
      { source: 'RISI', market: 'Europe', grade: 'EKP', low: 1050, high: 1110, sentiment: 'neutral', daysAgo: 7 },
      { source: 'TTO', market: 'Europe', grade: 'BKP', low: 940, high: 1000, sentiment: 'neutral', daysAgo: 6 },
      { source: 'RISI', market: 'North America', grade: 'UKP Paper', low: 870, high: 930, sentiment: 'bearish', daysAgo: 4 },
      { source: 'TTO', market: 'LATAM', grade: 'BKP', low: 960, high: 1020, sentiment: 'bullish', daysAgo: 8 },
    ]

    for (const insight of expertData) {
      await client.query(
        `INSERT INTO expert_insights (source, market_id, grade_id, price_forecast_low, price_forecast_high, sentiment, date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          insight.source,
          marketMap[insight.market],
          gradeMap[insight.grade],
          insight.low,
          insight.high,
          insight.sentiment,
          format(subDays(now, insight.daysAgo), 'yyyy-MM-dd'),
        ]
      )
    }

    // Events
    const eventsData = [
      { type: 'outage', company: 'Resolute Forest Products', description: 'Planned maintenance outage at Bowater mill reducing capacity by 80,000 ADMT for 3 weeks', daysAgo: 14 },
      { type: 'price_increase', company: 'Suzano', description: 'Suzano announced $30/ton list price increase effective next month for hardwood grades', daysAgo: 7 },
      { type: 'capacity', company: 'APP Indonesia', description: 'APP announces 200,000 ton/year capacity expansion, commissioning scheduled for Q2 next year', daysAgo: 30 },
      { type: 'price_increase', company: 'CMPC', description: 'CMPC raises softwood pulp prices by $20/ton in European market citing logistic cost increases', daysAgo: 5 },
      { type: 'outage', company: 'Mercer International', description: 'Force majeure declared at Celgar mill following equipment failure; 60,000 ADMT impacted', daysAgo: 3 },
    ]

    for (const event of eventsData) {
      await client.query(
        `INSERT INTO events (type, company, description, date)
         VALUES ($1, $2, $3, $4)`,
        [
          event.type,
          event.company,
          event.description,
          format(subDays(now, event.daysAgo), 'yyyy-MM-dd'),
        ]
      )
    }

    // Meeting notes
    const meetingNotesData = [
      {
        market: 'China',
        customer: 'Shandong Sun Paper',
        daysAgo: 2,
        sourceType: 'customer_meeting',
        rawText: 'Met with procurement director at Shandong Sun Paper. They confirmed strong demand for Q3 and expressed price acceptance for the upcoming quarter. Mentioned competitors are also increasing prices, especially Suzano raised their offer by $30. Supply remains tight in the market. Customer is willing to increase volume by 10% if we can guarantee stable supply.',
        sentiment: 'bullish',
        signals: ['price_mention', 'competitor_increasing', 'tight_supply', 'demand_shift'],
        tags: ['customer', 'price_pressure', 'demand'],
      },
      {
        market: 'China',
        customer: 'Nine Dragons Paper',
        daysAgo: 5,
        sourceType: 'customer_meeting',
        rawText: 'Discussion with Nine Dragons trading team. They indicated some price resistance at current levels for EKP grade. Customer mentioned high inventory levels from previous quarter. They are reducing volume commitments by approximately 15% in Q3. Competitor APP is offering significant discounts to maintain volumes.',
        sentiment: 'bearish',
        signals: ['price_resistance', 'competitor_mention'],
        tags: ['customer', 'competitor'],
      },
      {
        market: 'Europe',
        customer: 'Sappi Europe',
        daysAgo: 4,
        sourceType: 'agent_call',
        rawText: 'Call with our European agent covering Sappi account. Sappi reports stable demand from their tissue and packaging operations. No strong signals either way. They mentioned UPM has been offering competitive pricing but nothing aggressive. Market appears balanced with no major supply disruptions anticipated.',
        sentiment: 'neutral',
        signals: ['competitor_mention', 'price_mention'],
        tags: ['customer', 'competitor'],
      },
      {
        market: 'North America',
        customer: null,
        daysAgo: 7,
        sourceType: 'internal_meeting',
        rawText: 'Internal strategy review for North America market. P&W segment continues to decline structurally. However, packaging grades showing interesting growth. We discussed whether to pivot allocation toward packaging customers. Competitive pressure from Canadian producers is intense. No room for price increases in the short term. Consider maintaining current pricing to protect volume.',
        sentiment: 'bearish',
        signals: ['price_resistance', 'competitor_mention'],
        tags: ['price_pressure', 'supply_issue'],
      },
      {
        market: 'Asia Pacific',
        customer: 'Nippon Paper Industries',
        daysAgo: 3,
        sourceType: 'customer_meeting',
        rawText: 'Visit to Nippon Paper headquarters in Tokyo. Management reports that destocking phase is complete and they are returning to normal procurement levels. Strong demand from packaging division. They anticipate increasing orders by 20% in Q4. Capacity at their Hokkaido mill is running at 92% utilization, higher than recent months. Price increase accepted without major pushback.',
        sentiment: 'bullish',
        signals: ['price_increase accepted', 'demand_shift', 'tight_supply'],
        tags: ['customer', 'demand'],
      },
    ]

    for (const note of meetingNotesData) {
      const mid = marketMap[note.market]
      let cid: number | null = null
      if (note.customer && customerMap[note.customer]) {
        cid = customerMap[note.customer]
      }
      await client.query(
        `INSERT INTO meeting_notes (market_id, customer_id, date, source_type, raw_text, extracted_sentiment, extracted_signals, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          mid,
          cid,
          format(subDays(now, note.daysAgo), 'yyyy-MM-dd'),
          note.sourceType,
          note.rawText,
          note.sentiment,
          JSON.stringify(note.signals),
          JSON.stringify(note.tags),
        ]
      )
    }

    await client.query('COMMIT')
    console.log('Seed completed successfully.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Seed failed:', err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

seed().catch(console.error)
