import { z } from 'zod'

// ─── Core extracted signal schema ────────────────────────────────────────────
// Every AI-analyzed text must conform to this schema before being stored.
// Zod validation is mandatory — invalid outputs are rejected or repaired once.

export const ExtractedPriceMentionSchema = z.object({
  value: z.number(),
  currency: z.string(),
  unit: z.string(),
  context: z.string(),
})

export const ExtractedSignalSchema = z.object({
  source_type: z.enum(['meeting_note', 'market_news', 'expert_report', 'internal_note']),
  market: z.string().nullable(),
  grade: z.string().nullable(),
  customers_mentioned: z.array(z.string()),
  competitors_mentioned: z.array(z.string()),
  countries_mentioned: z.array(z.string()),
  sentiment: z.enum(['bullish', 'neutral', 'bearish']),
  sentiment_confidence: z.number().min(0).max(100),
  demand_signal: z.enum(['stronger', 'unchanged', 'weaker', 'unclear']),
  supply_signal: z.enum(['tighter', 'unchanged', 'looser', 'unclear']),
  inventory_signal: z.enum(['low', 'normal', 'high', 'unclear']),
  price_pressure_signal: z.enum(['upward', 'flat', 'downward', 'unclear']),
  competitor_action_signal: z.array(z.string()),
  extracted_price_mentions: z.array(ExtractedPriceMentionSchema),
  key_themes: z.array(z.string()),
  risks: z.array(z.string()),
  opportunities: z.array(z.string()),
  summary_short: z.string(),
  summary_long: z.string(),
  recommended_tags: z.array(z.string()),
  ambiguity_flags: z.array(z.string()),
  raw_relevance_score: z.number().min(0).max(100),
})

export type ExtractedSignal = z.infer<typeof ExtractedSignalSchema>
export type ExtractedPriceMention = z.infer<typeof ExtractedPriceMentionSchema>

// ─── Review status ────────────────────────────────────────────────────────────
export type ReviewStatus = 'pending_review' | 'approved' | 'rejected' | 'edited'

// ─── Stored analyzed text record ─────────────────────────────────────────────
export interface AnalyzedText {
  id: number
  source_type: 'meeting_note' | 'market_news' | 'expert_report' | 'internal_note'
  market_id: number | null
  customer_id: number | null
  grade_id: number | null
  raw_text: string
  ai_output_json: ExtractedSignal | null
  user_corrected_json: Partial<ExtractedSignal> | null
  final_structured_json: ExtractedSignal | null
  ai_summary_short: string | null
  ai_summary_long: string | null
  ai_model: string | null
  prompt_version: string
  review_status: ReviewStatus
  created_at: string
  updated_at: string
}

// ─── AI signals input for pricing engine ─────────────────────────────────────
// Derived from reviewed AnalyzedText records; fed as secondary influence only.
export interface AISignalsInput {
  // Aggregated sentiment from reviewed AI analyses
  sentimentBias: 'bullish' | 'neutral' | 'bearish' | null
  sentimentConfidence: number  // 0-100 avg of reviewed signals
  // Price pressure derived from reviewed analyses
  pricePressureSignal: 'upward' | 'flat' | 'downward' | 'unclear'
  // Supply/demand
  demandSignal: 'stronger' | 'unchanged' | 'weaker' | 'unclear'
  supplySignal: 'tighter' | 'unchanged' | 'looser' | 'unclear'
  // Competitive intelligence
  competitorActionFlags: string[]
  // Extracted price resistance evidence
  hasPriceResistanceEvidence: boolean
  hasCompetitorIncreaseEvidence: boolean
  // Ambiguity / confidence reduction
  totalAmbiguityFlags: number
  // Summary descriptions for explanation trace
  explanationLines: string[]
  // How many reviewed records this is based on
  reviewedRecordCount: number
}
