/**
 * AI extraction service.
 *
 * Converts unstructured commercial text into a validated ExtractedSignal.
 * Validation pipeline:
 *   1. Call AI → raw JSON string
 *   2. JSON.parse → if fails, attempt once to extract JSON block (repair)
 *   3. Zod validate → if fails, return structured error (no silent fallback)
 *
 * Callers must check ExtractionResult.success before using .data.
 * If aiAvailable=false the app runs without AI — rules engine is unaffected.
 */

import { callAI, PROMPT_VERSION } from './aiClient'
import { ExtractedSignalSchema, type ExtractedSignal } from './aiSchemas'
import { ZodError } from 'zod'

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a commercial intelligence analyst for a pulp and paper trading company.
Extract structured commercial signals from the provided text.

Rules:
- Return ONLY valid JSON matching the schema. No markdown, no prose, just the JSON object.
- Only extract signals clearly present in the text. Do not infer or hallucinate.
- Use "unclear" when there is insufficient information for a directional signal.
- Set sentiment_confidence based on how clearly and consistently the text supports the stated sentiment.
- Flag every ambiguity or uncertain inference in ambiguity_flags.
- Be conservative: a moderate signal is better than a false strong signal.`

function buildExtractionPrompt(text: string, sourceType: string): string {
  return `Analyze this ${sourceType.replace('_', ' ')} and extract commercial intelligence.

TEXT:
"""
${text.slice(0, 8000)}
"""

Return exactly this JSON structure (no other text):
{
  "source_type": "${sourceType}",
  "market": <string or null — e.g. "Europe", "China", "North America", "Latin America">,
  "grade": <string or null — e.g. "EKP", "BKP", "UKP">,
  "customers_mentioned": [<company/customer names>],
  "competitors_mentioned": [<pulp producer names e.g. Suzano, CMPC, APP, UPM, Sappi, Resolute, Mercer>],
  "countries_mentioned": [<country names>],
  "sentiment": <"bullish" | "neutral" | "bearish">,
  "sentiment_confidence": <0-100>,
  "demand_signal": <"stronger" | "unchanged" | "weaker" | "unclear">,
  "supply_signal": <"tighter" | "unchanged" | "looser" | "unclear">,
  "inventory_signal": <"low" | "normal" | "high" | "unclear">,
  "price_pressure_signal": <"upward" | "flat" | "downward" | "unclear">,
  "competitor_action_signal": [<specific competitor actions described — e.g. "Suzano announced $30/t increase effective Q2">],
  "extracted_price_mentions": [{"value": <number>, "currency": <"USD"|"EUR"|"other">, "unit": <"ton"|"ADT"|"other">, "context": <brief context>}],
  "key_themes": [<2-5 key commercial themes>],
  "risks": [<commercial risk factors explicitly mentioned>],
  "opportunities": [<commercial opportunities explicitly mentioned>],
  "summary_short": <1-2 sentence commercial summary>,
  "summary_long": <paragraph-length commercial analysis>,
  "recommended_tags": [<from: "demand", "supply", "competitor", "price_pressure", "customer", "supply_issue", "inventory", "capacity", "logistics", "macro">],
  "ambiguity_flags": [<things that are unclear, contradictory, or potentially misleading>],
  "raw_relevance_score": <0-100, how relevant is this to pulp market pricing>
}`
}

// ─── Result type ──────────────────────────────────────────────────────────────

export interface ExtractionResult {
  success: boolean
  data?: ExtractedSignal
  error?: string
  model?: string
  promptVersion: string
  aiAvailable: boolean
}

// ─── JSON repair helper ───────────────────────────────────────────────────────

function extractJSONBlock(raw: string): string | null {
  // Strip markdown code fences if present
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
  const match = stripped.match(/\{[\s\S]*\}/)
  return match ? match[0] : null
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function extractSignals(
  text: string,
  sourceType: 'meeting_note' | 'market_news' | 'expert_report' | 'internal_note',
): Promise<ExtractionResult> {
  const result = await callAI(
    SYSTEM_PROMPT,
    buildExtractionPrompt(text, sourceType),
    4096,
  )

  if (!result.available) {
    return {
      success: false,
      error: result.error || 'AI service unavailable',
      aiAvailable: false,
      promptVersion: PROMPT_VERSION,
    }
  }

  // Attempt 1: direct parse
  let parsed: unknown
  let parseError: string | null = null

  try {
    parsed = JSON.parse(result.content)
  } catch {
    // Attempt 2: repair — extract JSON block and retry once
    const repaired = extractJSONBlock(result.content)
    if (!repaired) {
      return {
        success: false,
        error: 'AI returned unparseable response (no JSON block found)',
        model: result.model,
        aiAvailable: true,
        promptVersion: PROMPT_VERSION,
      }
    }
    try {
      parsed = JSON.parse(repaired)
    } catch (e2) {
      parseError = e2 instanceof Error ? e2.message : String(e2)
      return {
        success: false,
        error: `JSON repair failed: ${parseError}`,
        model: result.model,
        aiAvailable: true,
        promptVersion: PROMPT_VERSION,
      }
    }
  }

  // Zod validation — strict, no coercion
  try {
    const validated = ExtractedSignalSchema.parse(parsed)
    return {
      success: true,
      data: validated,
      model: result.model,
      aiAvailable: true,
      promptVersion: PROMPT_VERSION,
    }
  } catch (err) {
    if (err instanceof ZodError) {
      const fieldErrors = (err as ZodError).issues
        .slice(0, 5)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((e: any) => `${Array.isArray(e.path) ? e.path.join('.') : e.path}: ${e.message}`)
        .join('; ')
      return {
        success: false,
        error: `Schema validation failed — ${fieldErrors}`,
        model: result.model,
        aiAvailable: true,
        promptVersion: PROMPT_VERSION,
      }
    }
    return {
      success: false,
      error: 'Unexpected validation error',
      model: result.model,
      aiAvailable: true,
      promptVersion: PROMPT_VERSION,
    }
  }
}
