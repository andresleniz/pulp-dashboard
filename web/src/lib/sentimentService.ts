import type { MarketNews, ExpertInsight, MeetingNote, SentimentScore } from '@/types'

function sentimentToNum(s: 'bullish' | 'neutral' | 'bearish'): number {
  if (s === 'bullish') return 1
  if (s === 'bearish') return -1
  return 0
}

export function computeSentimentScore(
  news: MarketNews[],
  expertInsights: ExpertInsight[],
  meetingNotes: MeetingNote[]
): SentimentScore {
  const newsScore = news.length > 0
    ? news.reduce((sum, n) => sum + sentimentToNum(n.sentiment), 0) / news.length
    : 0

  const expertScore = expertInsights.length > 0
    ? expertInsights.reduce((sum, e) => sum + sentimentToNum(e.sentiment), 0) / expertInsights.length
    : 0

  const meetingScore = meetingNotes.length > 0
    ? meetingNotes.reduce((sum, m) => sum + sentimentToNum(m.extracted_sentiment), 0) / meetingNotes.length
    : 0

  const weightedScore = newsScore * 0.3 + expertScore * 0.4 + meetingScore * 0.3

  let overall: 'bullish' | 'neutral' | 'bearish'
  if (weightedScore > 0.2) overall = 'bullish'
  else if (weightedScore < -0.2) overall = 'bearish'
  else overall = 'neutral'

  return {
    overall,
    score: Math.round(weightedScore * 1000) / 1000,
    sources: {
      news: Math.round(newsScore * 1000) / 1000,
      expert: Math.round(expertScore * 1000) / 1000,
      meetingNotes: Math.round(meetingScore * 1000) / 1000,
    },
  }
}
