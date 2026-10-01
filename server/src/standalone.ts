/**
 * Standalone replacement for `@hatch/space-sdk` (server side).
 *
 * Provides the small surface the app's `server/src/actions.ts` actually uses:
 * - `defineAction` / `ActionsModule` / `Ctx` (typing-compatible with the old SDK)
 * - `z` re-exported from zod
 * - `ctx.db()` backed by drizzle-orm + @libsql/client on a local SQLite file
 * - `ctx.tool.finance_ticker()` implemented against Yahoo Finance directly
 * - `ctx.viewer` hard-wired as owner (single-user deployment)
 * - `ctx.invalidateQueries()` as a no-op (the client refetches explicitly)
 *
 * Business logic in actions.ts is untouched; only the SDK wrapper changed.
 */
import { z } from "zod";
export { z };

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

// ---------------------------------------------------------------------------
// Action definition (keeps the same static typing shape the client relies on)
// ---------------------------------------------------------------------------
export interface Ctx {
  readonly db: <_TSchema extends Record<string, unknown> = Record<string, never>>() => Db;
  readonly invalidateQueries: () => void;
  readonly viewer: { readonly isOwner: boolean };
  readonly tool: {
    finance_ticker: (symbol: string, opts: { interval?: string; since?: string }) => Promise<FinanceTickerResult>;
  };
}

export type Db = Pick<
  LibSQLDatabase<any>,
  "select" | "insert" | "update" | "delete" | "run" | "all" | "get" | "batch"
>;

export function defineAction<Req extends z.ZodType, Res extends z.ZodType>(spec: {
  request: Req;
  response: Res;
  handler: (ctx: Ctx, args: z.infer<Req>) => Promise<z.infer<Res>>;
}): {
  request: Req;
  response: Res;
  handler: (ctx: Ctx, args: z.infer<Req>) => Promise<z.infer<Res>>;
} {
  return spec;
}

export type ActionsModule = Record<
  string,
  { request: z.ZodType; response: z.ZodType; handler: (ctx: Ctx, args: any) => Promise<any> }
>;

// ---------------------------------------------------------------------------
// SQLite via @libsql/client (file: URL = embedded SQLite, same as SDK local)
// ---------------------------------------------------------------------------
let dbInstance: Db | null = null;

export function sqlitePath(): string {
  return process.env.SQLITE_PATH || "./data/stock-picker.db";
}

export function getDb(): Db {
  if (!dbInstance) {
    const path = sqlitePath();
    mkdirSync(dirname(path), { recursive: true });
    const client = createClient({ url: `file:${path}` });
    dbInstance = drizzle(client) as unknown as Db;
  }
  return dbInstance;
}

export function createCtx(): Ctx {
  return {
    db: () => getDb(),
    invalidateQueries: () => {},
    viewer: { isOwner: true },
    tool: { finance_ticker: financeTicker },
  };
}

// ---------------------------------------------------------------------------
// finance_ticker via Yahoo Finance chart API (free, no key)
// Response shape mirrors the old managed tool so actions.ts is untouched.
// ---------------------------------------------------------------------------
export interface FinanceHistoryPoint {
  date: string | null;
  close: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
}

export interface FinanceTickerResult {
  content: {
    instrument: {
      symbol: string;
      name: string;
      price: number | null;
      change: number | null;
      change_percent: number | null;
      high: number | null;
      low: number | null;
      week_52_high: number | null;
      week_52_low: number | null;
      market_cap: number | null;
      market_status: string | null;
      as_of: string | null;
      currency: string | null;
      url: string | null;
      history: { points: FinanceHistoryPoint[] } | null;
    } | null;
    resolved: { matched: string; symbol: string };
    sources: Array<{ url: string }>;
  };
}

const YAHOO_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function isoDay(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

export async function financeTicker(
  symbol: string,
  opts: { interval?: string; since?: string } = {},
): Promise<FinanceTickerResult> {
  const url = `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
  const fail = (): FinanceTickerResult => ({
    content: { instrument: null, resolved: { matched: "none", symbol }, sources: [{ url }] },
  });
  try {
    let query: string;
    if (opts.since) {
      const p1 = Math.floor(new Date(`${opts.since}T00:00:00Z`).getTime() / 1000);
      const p2 = Math.floor(Date.now() / 1000);
      query = `period1=${p1}&period2=${p2}&interval=1d`;
    } else {
      query = `range=2y&interval=1d`;
    }
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`,
      { headers: { "User-Agent": YAHOO_UA, Accept: "application/json" } },
    );
    if (!res.ok) return fail();
    const json = (await res.json()) as any;
    const result = json?.chart?.result?.[0];
    if (!result) return fail();
    const meta = result.meta ?? {};
    const quote = result.indicators?.quote?.[0] ?? {};
    const timestamps: number[] = Array.isArray(result.timestamp) ? result.timestamp : [];
    const points: FinanceHistoryPoint[] = timestamps.map((ts: number, i: number) => ({
      date: isoDay(ts),
      close: num(quote.close?.[i]),
      open: num(quote.open?.[i]),
      high: num(quote.high?.[i]),
      low: num(quote.low?.[i]),
      volume: num(quote.volume?.[i]),
    }));

    const metaSymbol = String(meta.symbol ?? symbol);
    const norm = (s: string) => s.toUpperCase().replace(/\./g, "-");
    const matched = norm(metaSymbol) === norm(symbol) ? "exact" : "none";

    const price = num(meta.regularMarketPrice);
    // Change vs previous trading day, derived from the daily series (the
    // chart meta's chartPreviousClose predates the requested range, so it is
    // only a fallback). Self-consistent with the history the app stores.
    const closes = points.map((p) => p.close).filter((c): c is number => c !== null);
    const lastClose: number | null = closes.length > 0 ? (closes[closes.length - 1] as number) : price;
    const prevClose: number | null = closes.length >= 2
      ? (closes[closes.length - 2] as number)
      : num(meta.chartPreviousClose ?? meta.previousClose);
    const change = lastClose !== null && prevClose !== null ? lastClose - prevClose : null;
    const asOf = typeof meta.regularMarketTime === "number"
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : null;

    return {
      content: {
        instrument: {
          symbol: metaSymbol,
          name: String(meta.longName ?? meta.shortName ?? symbol),
          price,
          change,
          change_percent: change !== null && prevClose ? (change / prevClose) * 100 : null,
          high: num(meta.regularMarketDayHigh),
          low: num(meta.regularMarketDayLow),
          week_52_high: num(meta.fiftyTwoWeekHigh),
          week_52_low: num(meta.fiftyTwoWeekLow),
          market_cap: num(meta.marketCap),
          market_status: typeof meta.marketState === "string" ? meta.marketState : null,
          as_of: asOf,
          currency: typeof meta.currency === "string" ? meta.currency : null,
          url,
          history: { points },
        },
        resolved: { matched, symbol },
        sources: [{ url }],
      },
    };
  } catch {
    return fail();
  }
}

// ---------------------------------------------------------------------------
// Migrations: apply drizzle/*.sql in journal order using a raw sqlite handle
// ---------------------------------------------------------------------------
import { Database } from "bun:sqlite";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export function runMigrations(): void {
  const path = sqlitePath();
  mkdirSync(dirname(path), { recursive: true });
  const drizzleDir = join(process.cwd(), "drizzle");
  const journalPath = join(drizzleDir, "meta", "_journal.json");
  if (!existsSync(journalPath)) return;
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  const db = new Database(path);
  try {
    db.exec(
      "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at INTEGER);",
    );
    const applied = new Set(
      (db.query("SELECT hash FROM __drizzle_migrations").all() as Array<{ hash: string }>).map((r) => r.hash),
    );
    for (const entry of journal.entries) {
      // Journal tags already carry the numeric prefix (e.g. "0001_initial")
      const file = join(drizzleDir, `${entry.tag}.sql`);
      if (!existsSync(file) || applied.has(file)) continue;
      const sql = readFileSync(file, "utf8");
      db.exec("BEGIN;");
      try {
        // Strip drizzle's statement-breakpoint comments, then run as one script
        db.exec(sql.replace(/--> statement-breakpoint/g, ""));
        db.query("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)").run(
          file,
          Date.now(),
        );
        db.exec("COMMIT;");
      } catch (err) {
        db.exec("ROLLBACK;");
        throw err;
      }
    }
  } finally {
    db.close();
  }
}
