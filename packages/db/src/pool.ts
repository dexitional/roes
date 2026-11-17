import mysql from 'mysql2/promise'

// Kept on globalThis so dev hot reloads reuse one pool instead of opening a
// new one (and orphaning the old connections) every time a module reloads.
const globalForPool = globalThis as typeof globalThis & { __roesPool?: mysql.Pool }

export function getPool(): mysql.Pool {
  if (!globalForPool.__roesPool) {
    const uri = process.env.DATABASE_URL
    if (!uri) throw new Error('DATABASE_URL is not set.')
    globalForPool.__roesPool = mysql.createPool({
      uri,
      waitForConnections: true,
      connectionLimit: 10,
      // DATE/DATETIME come back as plain strings (no timezone shifting), and
      // DECIMAL money columns as numbers rather than strings.
      dateStrings: true,
      decimalNumbers: true,
    })
  }
  return globalForPool.__roesPool
}

/** Closes the pool so a CLI script can exit (servers never need this). */
export async function closePool() {
  const pool = globalForPool.__roesPool
  globalForPool.__roesPool = undefined
  await pool?.end()
}
