/**
 * Session-level data store — the single source of truth in mock/demo mode.
 *
 * Initialized with all static mock data so the prototype starts populated.
 * Every POST writes here; every GET and the pricing engine read from here.
 * Data survives for the lifetime of the Next.js dev-server process.
 *
 * Set DATABASE_URL in .env.local to switch everything to real PostgreSQL.
 */
import type {
  Order, CompetitorPrice, ExpertInsight, MarketNews,
  MeetingNote, Customer, Contract,
} from '@/types'
import type { AnalyzedText } from '@/lib/ai/aiSchemas'
import {
  mockOrders, mockCompetitorPrices, mockExpertInsights,
  mockMarketNews, mockMeetingNotes, mockCustomers, mockContracts,
  MOCK_NOW,
} from './mockData'

export { MOCK_NOW }

// ── mutable session store ─────────────────────────────────────────────────────
const store = {
  orders:           [...mockOrders]           as Order[],
  competitorPrices: [...mockCompetitorPrices] as CompetitorPrice[],
  expertInsights:   [...mockExpertInsights]   as ExpertInsight[],
  marketNews:       [...mockMarketNews]       as MarketNews[],
  meetingNotes:     [...mockMeetingNotes]     as MeetingNote[],
  customers:        [...mockCustomers]        as Customer[],
  contracts:        [...mockContracts]        as Contract[],
  analyzedTexts:    []                        as AnalyzedText[],
}

// ── Orders ────────────────────────────────────────────────────────────────────
export const getOrders           = (): Order[]           => store.orders
export const addOrder            = (o: Order): void      => { store.orders.push(o) }

// ── Competitor Prices ─────────────────────────────────────────────────────────
export const getCompetitorPrices = (): CompetitorPrice[] => store.competitorPrices
export const addCompetitorPrice  = (cp: CompetitorPrice): void => { store.competitorPrices.push(cp) }

// ── Expert Insights ───────────────────────────────────────────────────────────
export const getExpertInsights   = (): ExpertInsight[]  => store.expertInsights
export const addExpertInsight    = (ei: ExpertInsight): void => { store.expertInsights.push(ei) }

// ── Market News ───────────────────────────────────────────────────────────────
export const getMarketNews       = (): MarketNews[]     => store.marketNews
export const addMarketNews       = (mn: MarketNews): void => { store.marketNews.push(mn) }

// ── Meeting Notes ─────────────────────────────────────────────────────────────
export const getMeetingNotes     = (): MeetingNote[]    => store.meetingNotes
export const addMeetingNote      = (mn: MeetingNote): void => { store.meetingNotes.push(mn) }

// ── Customers ─────────────────────────────────────────────────────────────────
export const getCustomers        = (): Customer[]       => store.customers

/**
 * Finds a customer by name within a market, or creates one if not found.
 * Used during CSV order ingestion when the file provides customer_name instead of customer_id.
 */
export function findOrCreateCustomer(name: string, marketId: number): Customer {
  const normalised = name.trim().toLowerCase()
  const existing = store.customers.find(
    c => c.name.toLowerCase() === normalised && c.market_id === marketId
  )
  if (existing) return existing
  const newCustomer: Customer = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: name.trim(),
    market_id: marketId,
    created_at: new Date().toISOString(),
  }
  store.customers.push(newCustomer)
  return newCustomer
}

// ── Contracts ─────────────────────────────────────────────────────────────────
export const getContracts        = (): Contract[]       => store.contracts

// ── Analyzed Texts (AI layer) ─────────────────────────────────────────────────
export const getAnalyzedTexts    = (): AnalyzedText[]   => store.analyzedTexts
export const addAnalyzedText     = (at: AnalyzedText): void => { store.analyzedTexts.push(at) }
export function updateAnalyzedText(id: number, updates: Partial<AnalyzedText>): AnalyzedText | null {
  const idx = store.analyzedTexts.findIndex(at => at.id === id)
  if (idx === -1) return null
  store.analyzedTexts[idx] = { ...store.analyzedTexts[idx], ...updates, updated_at: new Date().toISOString() }
  return store.analyzedTexts[idx]
}
