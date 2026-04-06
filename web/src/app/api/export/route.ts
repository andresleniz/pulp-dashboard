import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      marketId?: number
      format: 'pdf' | 'excel' | 'pptx'
    }

    const { format } = body

    if (!format || !['pdf', 'excel', 'pptx'].includes(format)) {
      return NextResponse.json({ error: 'format must be pdf, excel, or pptx' }, { status: 400 })
    }

    // Export generation is handled client-side using jsPDF and xlsx
    // This endpoint acknowledges the request and returns metadata
    return NextResponse.json({
      success: true,
      format,
      message: `${format.toUpperCase()} export initiated. Generation happens client-side.`,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('POST /api/export error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
