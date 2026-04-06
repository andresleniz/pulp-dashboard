import { NextRequest, NextResponse } from 'next/server'
import { runScenario, generateScenarioCurve } from '@/lib/scenarioEngine'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      currentPrice: number
      currentVolume: number
      currentMargin: number
      priceChangePct: number
      elasticity: number
    }

    const { currentPrice, currentVolume, currentMargin, priceChangePct, elasticity } = body

    if (
      currentPrice === undefined || currentVolume === undefined ||
      currentMargin === undefined || priceChangePct === undefined || elasticity === undefined
    ) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const result = runScenario({ currentPrice, currentVolume, currentMargin, priceChangePct, elasticity })

    // Generate curve for -20% to +20% in 1% steps
    const priceRange = Array.from({ length: 41 }, (_, i) => -20 + i)
    const curve = generateScenarioCurve(
      { currentPrice, currentVolume, currentMargin, elasticity },
      priceRange
    )

    return NextResponse.json({ result, curve })
  } catch (err) {
    console.error('POST /api/scenario error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
