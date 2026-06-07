import { vi } from "vitest";

/**
 * In-memory mock of @tauri-apps/plugin-sql that backs a tiny key-value table
 * approach: every statement is parsed into our minimal interpreter sufficient
 * for the queries db.ts emits.
 *
 * The intent isn't to be a SQL engine — it's just enough to round-trip
 * "INSERT … ON CONFLICT … DO UPDATE", "UPDATE … WHERE id = ?", and SELECT
 * predicates we actually use.
 *
 * To keep tests focused, we expose a fixture helper `__loadFixture` for
 * pre-seeding rows directly.
 */

interface Row { [k: string]: unknown }

const tables: Record<string, Row[]> = {};

function reset() {
  for (const k of Object.keys(tables)) delete tables[k];
  for (const t of ["companion", "memory", "conversations", "turns", "stats", "settings"]) {
    tables[t] = [];
  }
}

reset();

function table(sql: string): string | undefined {
  const m = sql.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i);
  return m?.[1]?.toLowerCase();
}

function columnsFromInsert(sql: string): string[] {
  const m = sql.match(/INSERT(?:\s+OR\s+IGNORE)?\s+INTO\s+\w+\(([^)]+)\)/i);
  if (!m) return [];
  return m[1].split(",").map((c) => c.trim());
}

function isInsert(sql: string)  { return /^\s*INSERT/i.test(sql); }
function isOrIgnore(sql: string){ return /INSERT\s+OR\s+IGNORE/i.test(sql); }
function isUpsert(sql: string)  { return /ON CONFLICT/i.test(sql); }
function isUpdate(sql: string)  { return /^\s*UPDATE/i.test(sql); }
function isSelect(sql: string)  { return /^\s*SELECT/i.test(sql); }

function selectColumns(sql: string): string[] | "*" {
  const m = sql.match(/SELECT\s+(.+?)\s+FROM/is);
  if (!m) return "*";
  const list = m[1].trim();
  if (list === "*") return "*";
  return list.split(",").map((c) => c.trim());
}

function rowMatchesWhere(row: Row, whereClause: string, params: unknown[], paramOffset: number): boolean {
  // Only support `WHERE x = ?` and `WHERE x IN (?,?,?)`
  const eq = whereClause.match(/(\w+)\s*=\s*\?/);
  if (eq) {
    const col = eq[1];
    const val = params[paramOffset];
    return row[col] === val;
  }
  const inMatch = whereClause.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
  if (inMatch) {
    const col = inMatch[1];
    const placeholders = inMatch[2].split(",").length;
    const set = new Set(params.slice(paramOffset, paramOffset + placeholders));
    return set.has(row[col]);
  }
  return true;
}

function paramsForWhere(sql: string, params: unknown[]): { whereParams: unknown[]; mainParams: unknown[] } {
  // crude: count placeholders before WHERE and split params
  const whereIdx = sql.search(/WHERE/i);
  if (whereIdx < 0) return { whereParams: [], mainParams: params };
  const beforeCount = (sql.slice(0, whereIdx).match(/\?/g) ?? []).length;
  return {
    mainParams: params.slice(0, beforeCount),
    whereParams: params.slice(beforeCount),
  };
}

class FakeDb {
  async execute(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number; lastInsertId: number }> {
    const t = table(sql);
    if (!t) throw new Error(`mock: cannot infer table from sql: ${sql}`);

    if (isInsert(sql)) {
      const cols = columnsFromInsert(sql);
      // VALUES list may include literal values like `1`, `''`, `0` — handle simple cases
      const values = sql.match(/VALUES\s*\(([^)]+)\)/i)?.[1].split(",").map((v) => v.trim()) ?? [];
      const row: Row = {};
      let pIdx = 0;
      for (let i = 0; i < cols.length; i++) {
        const tok = values[i];
        if (tok === "?") { row[cols[i]] = params[pIdx]; pIdx += 1; }
        else if (tok === "''") row[cols[i]] = "";
        else if (/^\d+$/.test(tok)) row[cols[i]] = Number(tok);
        else if (tok === "NULL") row[cols[i]] = null;
        else row[cols[i]] = tok.replace(/^'|'$/g, "");
      }
      // ON CONFLICT … DO UPDATE
      if (isUpsert(sql)) {
        const idCol = sql.match(/ON CONFLICT\((\w+)\)/i)?.[1] ?? "id";
        const existing = tables[t].find((r) => r[idCol] === row[idCol]);
        if (existing) {
          // crude: parse `DO UPDATE SET k = excluded.k, k2 = ...`
          const setClause = sql.match(/DO UPDATE SET\s+(.+)$/i)?.[1] ?? "";
          const assigns = setClause.split(",").map((s) => s.trim());
          for (const a of assigns) {
            const m = a.match(/(\w+)\s*=\s*(.+)/);
            if (!m) continue;
            const col = m[1];
            const expr = m[2];
            if (expr.startsWith("excluded.")) {
              existing[col] = row[expr.slice("excluded.".length)];
            } else if (expr.includes("+") ) {
              // e.g. "minutes + excluded.minutes" — pick first identifier and operand
              const parts = expr.split("+").map((s) => s.trim());
              const left = parts[0].includes(".")
                ? existing[parts[0].split(".")[1]] as number
                : existing[parts[0]] as number;
              const right = parts[1].startsWith("excluded.")
                ? row[parts[1].slice("excluded.".length)] as number
                : Number(parts[1]);
              existing[col] = (left ?? 0) + right;
            } else if (expr.startsWith("CASE")) {
              // approximate average semantics used in updateStatScores
              existing[col] = row[col];
            }
          }
          return { rowsAffected: 1, lastInsertId: 0 };
        }
      }
      // OR IGNORE: skip if id conflict
      if (isOrIgnore(sql)) {
        const idCol = "id";
        if (row[idCol] !== undefined && tables[t].some((r) => r[idCol] === row[idCol])) {
          return { rowsAffected: 0, lastInsertId: 0 };
        }
      }
      tables[t].push(row);
      return { rowsAffected: 1, lastInsertId: tables[t].length };
    }

    if (isUpdate(sql)) {
      const setClause = sql.match(/SET\s+(.+?)\s+WHERE/is)?.[1] ?? "";
      const assigns = setClause.split(",").map((s) => s.trim());
      const { mainParams, whereParams } = paramsForWhere(sql, params);
      let count = 0;
      for (const row of tables[t]) {
        const whereClause = sql.match(/WHERE\s+(.+)$/is)?.[1] ?? "";
        if (!rowMatchesWhere(row, whereClause, whereParams, 0)) continue;
        let p = 0;
        for (const a of assigns) {
          const colMatch = a.match(/(\w+)\s*=\s*\?/);
          if (!colMatch) continue;
          row[colMatch[1]] = mainParams[p];
          p += 1;
        }
        count += 1;
      }
      return { rowsAffected: count, lastInsertId: 0 };
    }

    throw new Error(`mock: unsupported execute sql: ${sql}`);
  }

  async select<T = Row>(sql: string, params: unknown[] = []): Promise<T> {
    if (!isSelect(sql)) throw new Error(`mock: select expects SELECT: ${sql}`);
    const t = table(sql);
    if (!t) return [] as unknown as T;
    const cols = selectColumns(sql);
    const whereClause = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/is)?.[1];
    let rows = tables[t].slice();
    let paramIdx = 0;
    if (whereClause) {
      // handle "x IN (?,?,?)"
      const inMatch = whereClause.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
      if (inMatch) {
        const placeholders = inMatch[2].split(",").length;
        const set = new Set(params.slice(0, placeholders));
        rows = rows.filter((r) => set.has(r[inMatch[1]]));
        paramIdx += placeholders;
      } else {
        const eq = whereClause.match(/(\w+)\s*=\s*\?/);
        if (eq) {
          rows = rows.filter((r) => r[eq[1]] === params[paramIdx]);
          paramIdx += 1;
        }
      }
    }
    // ORDER BY
    const orderMatch = sql.match(/ORDER BY\s+(\w+)(\s+DESC|\s+ASC)?/i);
    if (orderMatch) {
      const col = orderMatch[1];
      const dir = (orderMatch[2] ?? "").trim().toUpperCase() === "DESC" ? -1 : 1;
      rows.sort((a, b) => {
        const av = (a[col] as number) ?? 0;
        const bv = (b[col] as number) ?? 0;
        return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
      });
    }
    // LIMIT ?
    const limMatch = sql.match(/LIMIT\s+\?/i);
    if (limMatch) {
      const lim = params[params.length - 1] as number;
      rows = rows.slice(0, lim);
    }
    if (cols === "*") return rows as unknown as T;
    const projected = rows.map((r) => {
      const out: Row = {};
      for (const c of cols) out[c] = r[c];
      return out;
    });
    return projected as unknown as T;
  }
}

const dbSingleton = new FakeDb();

// `Database.load("sqlite:...")` returns the singleton
const Database = {
  load: vi.fn(async () => dbSingleton),
};

/** Test helper: reset all tables between tests. */
export function __resetDb() {
  reset();
}

/** Test helper: directly seed rows. */
export function __seed(tableName: string, rows: Row[]) {
  tables[tableName] = rows;
}

/** Test helper: read raw rows. */
export function __peek(tableName: string): Row[] {
  return tables[tableName].slice();
}

export default Database;
