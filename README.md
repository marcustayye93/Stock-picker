# Stock Picker

A private stock research tool: long-term valuation shortlist (Invest) plus
weekly technical setups (Trade) over the S&P 500.

## What it does

- **Invest** — ranks stocks by business quality and discount to estimated
  value, with buy/sell price levels per name.
- **Trade** — one weekly scan for three objective setups (breakouts, trend
  pullbacks, momentum leaders), each with entry levels, invalidation rules,
  and position sizing. Stocks reporting earnings within 7 days of the scan
  are excluded automatically.

## Stack

- Client: React 19 + TypeScript + Tailwind, built with `client/build.mjs`
- Server: Bun + TypeScript (`server/src/actions.ts`), SQLite via drizzle-orm
- Market data: Yahoo Finance (prices), SEC EDGAR (fundamentals)

## Layout

- `client/src` — UI source
- `server/src` — data actions and schema
- `drizzle/` — SQLite migrations
- `client/src/data` — bundled reference datasets (frozen snapshots)

## Notes

- `app.db` (local SQLite data: watchlist, weekly runs) is intentionally not
  committed.
- Built with Bun 1.3.10: `bun install`, then `bun run build`.
