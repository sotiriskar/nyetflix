import type { NextApiRequest, NextApiResponse } from 'next'
import { Pool } from 'pg'

const pool = new Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { query } = req

  // Get the ORDER BY columns and direction from the query parameters
  const sortBy = ((query.sortby as string) || 'id').split(',')
  const sortDir = (query.sortdir === 'desc') ? 'DESC' : 'ASC'

  // Build the WHERE clause dynamically based on the query parameters
  const whereClause = Object.keys(query)
    .filter(param => param !== 'sortby' && param !== 'sortdir')
    .map(param => {
      let value = query[param]
      if (Array.isArray(value)) {
        value = value.map(v => v.toLowerCase())
      } else {
        if (value) {
          value = value.toLowerCase()
        } else {
          value = ''
        }
      }
      return `${param} ILIKE '%${value}%'`
    })
    .join(' AND ')

  // connect to the PostgreSQL database with name "nyetflix" and table "movies"
  const client = await pool.connect()
  const result = await client.query(`SELECT * FROM nyetflix.movies${whereClause ? ` WHERE ${whereClause}` : ''} ORDER BY ${sortBy.map(column => `${column} ${sortDir}`).join(', ')}`)
  const data = result.rows
  client.release()

  res.status(200).json(data)
}

