import type { ScenarioResult } from '@/types'

export interface ScenarioInputs {
  currentPrice: number
  currentVolume: number
  currentMargin: number
  priceChangePct: number
  elasticity: number
}

export function runScenario(inputs: ScenarioInputs): ScenarioResult {
  const { currentPrice, currentVolume, currentMargin, priceChangePct, elasticity } = inputs

  const newPrice = currentPrice * (1 + priceChangePct / 100)

  // Expected volume change
  const expectedVolumePct = priceChangePct * elasticity
  const expectedVolume = currentVolume * (1 + expectedVolumePct / 100)

  // Revenue
  const currentRevenue = currentPrice * currentVolume
  const expectedRevenue = newPrice * expectedVolume

  // Cost basis (constant per ton)
  const costPerTon = currentPrice - currentMargin
  const currentTotalMargin = currentMargin * currentVolume
  const expectedTotalMargin = (newPrice - costPerTon) * expectedVolume

  const expectedVolumeChangePct = expectedVolumePct
  const expectedMarginChangePct = currentTotalMargin !== 0
    ? ((expectedTotalMargin - currentTotalMargin) / Math.abs(currentTotalMargin)) * 100
    : 0
  const expectedRevenueChangePct = currentRevenue !== 0
    ? ((expectedRevenue - currentRevenue) / Math.abs(currentRevenue)) * 100
    : 0

  return {
    priceChangePct,
    elasticity,
    currentPrice,
    currentVolume,
    expectedVolume: Math.round(expectedVolume),
    expectedRevenue: Math.round(expectedRevenue),
    expectedMargin: Math.round(expectedTotalMargin),
    expectedVolumeChangePct: Math.round(expectedVolumeChangePct * 100) / 100,
    expectedMarginChangePct: Math.round(expectedMarginChangePct * 100) / 100,
    expectedRevenueChangePct: Math.round(expectedRevenueChangePct * 100) / 100,
  }
}

export function generateScenarioCurve(
  inputs: Omit<ScenarioInputs, 'priceChangePct'>,
  priceRange: number[]
): ScenarioResult[] {
  return priceRange.map(pct =>
    runScenario({ ...inputs, priceChangePct: pct })
  )
}
