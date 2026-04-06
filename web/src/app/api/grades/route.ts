import { NextResponse } from 'next/server'
import { useMockData, query } from '@/lib/db'
import { mockGrades } from '@/lib/mockData'

export async function GET() {
  try {
    if (useMockData) {
      return NextResponse.json(mockGrades)
    }
    const result = await query('SELECT * FROM grades ORDER BY name')
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('GET /api/grades error:', err)
    return NextResponse.json(mockGrades)
  }
}
