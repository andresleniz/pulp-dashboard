/**
 * Provider-agnostic AI client.
 *
 * Provider and model are driven by environment variables:
 *   AI_PROVIDER=anthropic   (default)
 *   AI_MODEL=claude-haiku-4-5-20251001   (default; override for more powerful models)
 *   ANTHROPIC_API_KEY=...
 *
 * If no API key is configured the client returns available=false and the app
 * continues to operate in rules-only mode. No crash, no silent fallback magic.
 */

import Anthropic from '@anthropic-ai/sdk'

export const PROMPT_VERSION = 'v1.0'

export interface AICompletionResult {
  content: string
  model: string
  available: boolean
  error?: string
}

function getProvider(): string {
  return process.env.AI_PROVIDER || 'anthropic'
}

function getModel(): string {
  return process.env.AI_MODEL || 'claude-haiku-4-5-20251001'
}

function getApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY
}

export function isAIAvailable(): boolean {
  const provider = getProvider()
  if (provider === 'anthropic') return !!getApiKey()
  return false
}

// Lazily initialized client — avoids crashing at module load when no key set
let _anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic | null {
  const key = getApiKey()
  if (!key) return null
  if (!_anthropicClient) {
    _anthropicClient = new Anthropic({ apiKey: key })
  }
  return _anthropicClient
}

/**
 * Send a prompt to the configured AI provider.
 * Returns available=false if AI is unconfigured or the call fails.
 * Never throws — callers must check `available`.
 */
export async function callAI(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4096,
): Promise<AICompletionResult> {
  const provider = getProvider()
  const model = getModel()

  if (provider === 'anthropic') {
    const client = getAnthropicClient()
    if (!client) {
      return {
        content: '',
        model,
        available: false,
        error: 'ANTHROPIC_API_KEY not configured',
      }
    }

    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      })

      const textBlock = response.content.find(b => b.type === 'text')
      const content = textBlock && textBlock.type === 'text' ? textBlock.text : ''

      return { content, model, available: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[aiClient] Anthropic API error:', message)
      return { content: '', model, available: false, error: message }
    }
  }

  return {
    content: '',
    model,
    available: false,
    error: `Unsupported AI_PROVIDER: ${provider}`,
  }
}
