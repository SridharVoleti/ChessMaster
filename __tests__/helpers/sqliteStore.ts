// Test-only `Sql` implementation: an in-process SQLite engine standing in
// for Postgres. The AuthzService's SQL is deliberately plain (no Postgres-
// only syntax), so the same query strings run here unchanged apart from:
//   • `chessmaster.` schema qualifier — stripped (SQLite has no schemas)
//   • `$1, $2, …` placeholders — rewritten to positional `?`
//
// Never imported by app/ or lib/ — better-sqlite3 is a devDependency.

import Database from 'better-sqlite3'
import { AUTHZ_SCHEMA_SQL, type Sql } from '@/lib/authz/store'

const toSqlite = (text: string) =>
  text.replace(/chessmaster\./g, '').replace(/\$\d+/g, '?')

const TEST_SCHEMA_SQL = toSqlite(AUTHZ_SCHEMA_SQL).replace(/create schema[^;]*;/gi, '')

/** A fresh, isolated in-memory database per call. */
export function makeSqliteSql(): Sql {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(TEST_SCHEMA_SQL)

  return {
    async query<Row = Record<string, unknown>>(text: string, params: readonly unknown[] = []) {
      const stmt = db.prepare(toSqlite(text))
      const args = params as unknown[]
      if (/^\s*select/i.test(text)) {
        return { rows: stmt.all(...args) as Row[] }
      }
      stmt.run(...args)
      return { rows: [] as Row[] }
    },
  }
}
