# Data Plan

## Prototype scope
This private prototype presents only the approved US methodology v1.2.7 Stage 2 price-zone run. Stage 1 quality scoring, Part 8, SGX coverage, refresh logic, alerts, intrinsic value, screeners, and watchlists are not part of this prototype.

## Bundled source snapshot
- Source file: `/home/hatch/workspace/research_notes/stock-tool-prototype-v1/v1.2.7-zones-compact.json`
- Runtime copy: `client/src/data/zones.json`
- Market-data source recorded by the finished research: Yahoo Finance daily bars
- Input snapshot: `yahoo-store/2025-07-01_to_2026-09-25/v1`
- Frozen constituent file: `universe-frozen-2026-09-25.csv`
- Last-close date: `2026-09-24`
- Universe: 503 securities from the frozen 2026-09-25 constituent list, labelled S&P 500 in the approved methodology
- Methodology: v1.2.7, hash `187fc1ae2d89eac6a62c2445e80fcb45e3658702139df1789ee30656474250b6`
- Run: `stage2-2026-09-26-79221605`

The full source JSON is bundled without generated, sampled, or synthetic ticker rows. Null fields render as unavailable. Empty zone ranks retain their machine reason code and plain-language explanation.

## Displayed derivations
- The overview reads the 503-security count, buy/sell zone-count distributions, both-sides-L1 count, dates, run identifiers, and survivorship note directly from the JSON summary.
- The ticker detail reads last close, ATR(14), SMA(200), inside-zone flags, zone bounds, midpoint, near-edge ATR distance, anchor date, confirmation date, age, and state from the selected ticker row.
- Price position versus SMA(200) is computed directly from the selected ticker's bundled last close and SMA(200).
- The vertical ladder domain is derived from the selected ticker's current close and all published zone bounds. Missing ranks remain visible as gaps with their source explanation.

## Caveats shown in the interface
- Survivorship bias applies because the app uses a frozen 2026-09-25 constituent list.
- Zones are historical levels, not predictions, targets, recommendations, or instructions.
- A zone is based on a 5-bar fractal pivot and expires as information if its anchor or an input bar is revised.
- The prototype is frozen. It does not fetch or claim current-at-open market data.

## External links and imagery
The research report supplied no public source URL, so the prototype names Yahoo Finance as the source but does not invent or reconstruct a link. The opening hero uses the user-supplied looping brain GIF copied into `client/src/assets/spinning-brain.gif`. The meaningful data visuals remain charts bound directly to the bundled data file.

## Mobile stock picker UI batch
- `client/src/data/picker-sample-rows-v1.json` is a byte-for-byte build-time copy of `/home/hatch/workspace/victor-debate/v1.2-us/ui-data/picker-sample-rows-v1.json`. Its 10 rows are illustrative and remain visibly marked `SAMPLE`; they are the only rows used by the picker and screener.
- `client/src/data/picker-levels-v1.json` is a byte-for-byte build-time copy of `/home/hatch/workspace/victor-debate/v1.2-us/ui-data/picker-levels-v1.json`. It supplies the real v1.2.7 historical buying and selling levels for all 503 frozen-universe securities.
- Sample valuation ranges and real historical levels are not mixed: sample values determine only the illustrative picker order, while historical levels appear only on stock detail as timing context.
- Watchlist writes continue through the existing `upsertWatchItem` and `removeWatchItem` server actions. No schema or existing action was changed.

## Business health checklist display batch
- `client/src/data/checklist-compact.json` is a byte-for-byte build-time copy of `/home/hatch/workspace/victor-debate/v1.2-us/runs/valuation-2026-09-27-r3/checklist-compact.json` (315 ticker rows).
- A detail screen renders the checklist only when the bundled source has a matching ticker. It renders only the checks present in that row, ordered by the source's internal check ID; missing checks do not produce placeholders.
- The displayed total uses the source row's `total`, with a denominator of `live × 10`. Per-check status glyphs use the source `status`; evidence text is composed from the source `v` value and approved pass/fail wording.
- The checklist is explicitly labelled as illustrative until the 26-week internal run completes. It is display-only and is not used to order picker rows, rank securities, or produce a buy signal.


## Production-pipeline mobile build, 2026-09-27
- `client/src/data/pipeline-universe-v1.json` is a build-time projection of the 305 non-financial rows in `/home/hatch/workspace/victor-debate/v1.2-us/runs/valuation-2026-09-27-r7/per-ticker-nonfinancials.jsonl`, the 10 bank rows in `/home/hatch/workspace/victor-debate/v1.2-us/runs/valuation-2026-09-27-r7/per-ticker-banks.jsonl`, and run metadata from `/home/hatch/workspace/victor-debate/v1.2-us/runs/valuation-2026-09-27-r7/summary.json`.
- The bundled rows preserve ticker, price and price date, intrinsic range and range date, width tier, layer, BQ score/status, eligibility, exclusion code, lookup reason, disclosure lines, valuation severity deductions, failure codes, and published rank. No range or score is synthesized when the source is null.
- `client/src/data/pipeline-checklist-v1.json` is a build-time projection of all 315 ticker rows from `/home/hatch/workspace/victor-debate/v1.2-us/runs/valuation-2026-09-27-r3/checklist.jsonl`. It retains only the six live fundamental check IDs 1, 2, 3, 4, 5, and 8, with each source title, score/status, value display, explanation, method, provenance, as-of date, and no-data reason preserved.
- The ranked cards are read from the r7 summary rank positions. Screener results are deterministic client-side filters over the 305 non-financial rows. Bank rows are available through ticker search and detail, with their source status shown as not scored because the bank quality method is not approved.
- The existing v1.2.7 historical-level bundle remains unchanged and is joined by ticker on detail screens.
- User-entered valuation assumptions persist through the existing `saveAnalysis` action. Saved models, watchlist rows, quote health, and alert events come from `listWorkspace`; targets write through `upsertWatchItem`; quote checks call `refreshWatchlistQuotes` with `force: false`.

## Weekly technical trade ideas, revised 2026-09-29
- `refreshWeeklyIdeas` checks a bundled set of liquid US tickers through the platform-managed `ctx.tool.finance_ticker` channel at daily resolution. It does not claim to cover the full current S&P 500. The action stores only dated source-returned results in `weekly_idea_runs` and `weekly_ideas`; a failed refresh preserves the prior snapshot.
- Every candidate must have a close of at least $5, prior 20-session median daily dollar volume of at least $20 million, annualised 20-session close-to-close volatility between 15% and 80%, and enough valid daily history. Missing, non-finite, zero-volume, or insufficient histories fail closed.
- A breakout must close above the prior 52-week high and prior 20-session high on at least 1.25 times the prior 20-session median dollar volume.
- A trend pullback must remain above a rising 50-day simple moving average, finish no more than 5% above it, have a positive three-month return, and have touched the average area within the latest five sessions.
- A momentum leader must rank in the top fifth of all otherwise eligible candidates by three-month return, remain above a rising 50-day average, and be no more than 10% above it.
- Qualifying candidates receive a transparent score combining three-month strength, a penalty for extension beyond 5% above the 50-day average, and small setup bonuses. The five highest scores are stored. The UI warns the reader to treat repeated industries as concentrated exposure; the scanner does not replace names merely to diversify the list.
- Buy 1–3 are generated from each setup’s own technical reference points. Sell 1–3 are the current close plus one, two, and three ATR(14) values. Each level and its setup metrics are persisted with that weekly idea instead of joined to the long-term frozen level bundle.
- Historical touch frequencies are computed during the same refresh from the source-returned daily bars. Up to eleven non-overlapping 63-session forward windows are sampled. A buy counts when a future low reaches the level; a sell counts when a future high reaches it. At least eight windows are required before a percentage is shown.
- These percentages describe past touch frequency only. They are not confidence scores, win rates, forecasts, or probabilities for the next trade. The UI states this beside the levels and sizing arithmetic.
- Each saved idea owns up to five years of dated daily closes from the qualifying response. The same refresh also stores SPY daily closes from `ctx.tool.finance_ticker("SPY")` as the S&P 500 comparison. The chart offers 1W, 1M, 3M, 1Y, and 5Y views, defaults to 1Y, and rebases SPY to the stock’s starting price only when the user enables the comparison.
- The sizing helper is client-side arithmetic over the user’s entered capital and selected Buy 1/2/3 split, the persisted trade levels, and their persisted historical touch frequencies. It does not write state, recommend a split, or calculate a predicted return.
- Before any technical match can enter the weekly list, `refreshWeeklyIdeas` reads Nasdaq's public earnings calendar for the US-market date through seven calendar days ahead from `https://api.nasdaq.com/api/calendar/earnings?date=YYYY-MM-DD`. Runtime host: `api.nasdaq.com`. Any matching ticker is held back until after its report date. If any day in the earnings window cannot be verified, the refresh fails closed and keeps the prior list rather than publishing unchecked ideas.
- Each successful run stores when the earnings calendar was checked, the final date covered, and how many otherwise qualifying setups were held back. The Trade tab shows that status beside the scan totals.
- The public trade list and its bounded six-hour refresh expose shared product output. Owner-owned analyses, watchlist rows, alerts, cached quotes, versions, and audit records are never returned without an owner viewer context.
