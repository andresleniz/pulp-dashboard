import { Pool, QueryResult } from 'pg'

export const useMockData = !process.env.DATABASE_URL

let pool: Pool | null = null

if (!useMockData) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  })
}

export { pool }

export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  if (!pool) {
    throw new Error('Database not configured. Running in demo mode.')
  }
  const client = await pool.connect()
  try {
    const result = await client.query(text, params)
    return result
  } finally {
    client.release()
  }
}
