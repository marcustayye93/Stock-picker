import { useEffect, useId, useLayoutEffect, useMemo, useState, type PointerEvent, type ReactNode } from "react";
import { SafeAreaTopScrim } from "./safe-area";
import { api, type ApiResponse } from "./api";
import pipelineRaw from "./data/pipeline-universe-v1.json";
import checklistRaw from "./data/pipeline-checklist-v1.json";
import levelsRaw from "./data/picker-levels-v1.json";
import hitRatesRaw from "./data/level-hit-rates-v1.json";

type Tab = "picker" | "ideas" | "watchlist" | "screener" | "more";
type Rank = "L1" | "L2" | "L3";
type Side = "buy" | "sell";
type Tier = "tight" | "moderate" | "wide" | "capped-wide";
type Layer = "A" | "B";
type ChecklistStatus = "pass" | "partial" | "fail" | "no_data";

type PipelineRow = {
  ticker: string;
  name: string | null;
  price: number | null;
  price_date: string | null;
  range: [number, number] | null;
  range_as_of: string | null;
  tier: Tier | null;
  layer: Layer | null;
  bq_score: number | null;
  bq_status: "scored" | "fail" | "not_ranked";
  eligible: boolean;
  exclusion_code: "NOT_BELOW" | "CASH_FLOW_NONPOSITIVE" | "DATA_GAP" | null;
  lookup_reason: string;
  card_lines: string[];
  width_points: number | null;
  stability_points: number | null;
  bq_fail_codes: string[];
  rank: number | null;
  bank: boolean;
};

type PipelineMeta = {
  engine_version: string;
  run_id: string;
  snapshot_id: string;
  price_as_of: string;
  run_as_of: string;
  clock_run: number;
  clock_total: number;
  run_hash: string;
  chain_hash: string;
  tier_counts: Record<string, number>;
  refuse_counts: Record<string, number>;
};

type ChecklistCheck = {
  id: number;
  title: string;
  question: string;
  tells: string;
  score: 10 | 5 | 0 | null;
  status: ChecklistStatus;
  value_display: string;
  method: string;
  source: string;
  as_of: string;
  reason: string | null;
};

type ChecklistRow = { ticker: string; total: number; live_checks: number; checks: ChecklistCheck[] };

type PublishedLevel = { state: "PUBLISHED"; lower: number; upper: number; anchor: number; anchor_date: string; confirmed: string; dist_atr: number };
type UnavailableLevel = { state: null; null_reason: string };
type Level = PublishedLevel | UnavailableLevel;
type LevelStock = { ticker: string; name: string; asof: string; last_close: number; last_date: string; buy: Record<Rank, Level>; sell: Record<Rank, Level> };
type LevelSelection = { side: Side; rank: Rank; level: PublishedLevel };
type LevelCode = "B1" | "B2" | "B3" | "S1" | "S2" | "S3";
type HitRate = { cases: number; hits: number | null; rate: number | null };
type HitRateData = { meta: { as_of: string; forward_sessions: number; minimum_cases: number; maximum_display_cases: number; similarity_tolerance_percentage_points: number; source: string; method: string }; symbols: Record<string, Partial<Record<LevelCode, HitRate>>> };

type WatchItem = ApiResponse<typeof api, "listWorkspace">["watchlist"][number];
type AlertItem = ApiResponse<typeof api, "listWorkspace">["alerts"][number];
type WeeklyIdeaRun = ApiResponse<typeof api, "listWeeklyIdeas">["run"];
type WeeklyIdea = ApiResponse<typeof api, "listWeeklyIdeas">["ideas"][number];
type IdeaTradeLevel = NonNullable<WeeklyIdea["setupDetail"]>["buyLevels"][number];
type ChartRange = "1W" | "1M" | "3M" | "1Y" | "5Y";
type PickerSort = "strength" | "discount";

const pipeline = pipelineRaw as { meta: PipelineMeta; rows: PipelineRow[] };
const allRows = pipeline.rows;
const universeRows = allRows.filter((row) => !row.bank);
const rowByTicker = new Map(allRows.map((row) => [row.ticker, row]));
const checklistByTicker = new Map((checklistRaw as ChecklistRow[]).map((row) => [row.ticker, row]));
const levels = levelsRaw as Record<string, LevelStock>;
const hitRates = hitRatesRaw as HitRateData;
const rankedRows = universeRows.filter((row) => row.rank !== null).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
const ranks: Rank[] = ["L1", "L2", "L3"];
const tierOptions: Tier[] = ["tight", "moderate", "wide", "capped-wide"];
const MODEL_SUMMARY = "We check how healthy each business looks, then show you the ones priced furthest below that health.";
const UNIVERSE_LABEL = "305 large US companies outside the financial sector";
const UNIVERSE_NOTE = "The company list was fixed on 25 Sep 2026.";

type DraftHorizon = "Close by" | "A bit of a wait" | "A longer wait" | "A bit further" | "Further out";
type DraftArea =
  | { state: "published"; range: string; horizon: DraftHorizon }
  | { state: "unpublished" }
  | { state: "passed" };
type DraftStock = {
  ticker: "CMCSA" | "CNC" | "CHTR";
  price: number;
  range: [number, number];
  quality: number;
  confidence: "High confidence" | "Moderate confidence" | "Low confidence";
  buy: [DraftArea, DraftArea, DraftArea];
  sell: [DraftArea, DraftArea, DraftArea];
};

const UNPUBLISHED_AREA: DraftArea = { state: "unpublished" };
const DRAFT_SHORTLIST: DraftStock[] = [
  {
    ticker: "CMCSA",
    price: 21.91,
    range: [38.30, 57.84],
    quality: 56,
    confidence: "High confidence",
    buy: [{ state: "published", range: "$21.10–$21.50", horizon: "Close by" }, UNPUBLISHED_AREA, UNPUBLISHED_AREA],
    sell: [{ state: "published", range: "$24.10–$24.50", horizon: "A bit further" }, UNPUBLISHED_AREA, { state: "published", range: "$24.50–$24.90", horizon: "Further out" }],
  },
  {
    ticker: "CNC",
    price: 61.82,
    range: [62.70, 119.27],
    quality: 44,
    confidence: "Moderate confidence",
    buy: [{ state: "published", range: "$59.30–$60.50", horizon: "A bit of a wait" }, UNPUBLISHED_AREA, { state: "published", range: "$56.20–$57.30", horizon: "A longer wait" }],
    sell: [{ state: "published", range: "$66.00–$67.10", horizon: "A bit further" }, UNPUBLISHED_AREA, { state: "published", range: "$67.80–$69.00", horizon: "Further out" }],
  },
  {
    ticker: "CHTR",
    price: 112.91,
    range: [162.96, 332.29],
    quality: 18,
    confidence: "Moderate confidence",
    buy: [UNPUBLISHED_AREA, UNPUBLISHED_AREA, UNPUBLISHED_AREA],
    sell: [{ state: "published", range: "$135.30–$138.70", horizon: "Further out" }, UNPUBLISHED_AREA, UNPUBLISHED_AREA],
  },
];

function isPublished(level: Level): level is PublishedLevel { return level.state === "PUBLISHED"; }
function money(value: number | null, currency = "$" ): string {
  if (value === null || !Number.isFinite(value)) return "No data";
  return `${currency}${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
}
function dateLabel(value: string | null): string {
  if (!value) return "No date";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed);
}
function percentBelow(row: PipelineRow): number | null {
  if (row.price === null || row.range === null || row.range[0] <= 0) return null;
  return ((row.range[0] - row.price) / row.range[0]) * 100;
}
function chartDateLabel(value: string, includeYear: boolean): string {
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", includeYear ? { month: "short", year: "2-digit", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" }).format(parsed);
}
function formatPercent(value: number | null): string { return value === null || !Number.isFinite(value) ? "No data" : `${value.toFixed(1)}%`; }
function bundledCompanyName(ticker: string, fallback?: string | null): string { return levels[ticker]?.name ?? fallback ?? ticker; }
function displayName(row: PipelineRow): string { return bundledCompanyName(row.ticker, row.name); }
function tierLabel(tier: Tier | null): string {
  if (tier === "tight") return "High confidence";
  if (tier === "moderate") return "Moderate confidence";
  if (tier === "wide") return "Low confidence";
  if (tier === "capped-wide") return "Rough guide only";
  return "No estimate";
}
function rankLabel(side: Side, rank: Rank): string { return `${side === "buy" ? "Lower" : "Upper"} ${rank.slice(1)}`; }
function numberOrNull(value: string): number | null { const parsed = Number(value); return value.trim() !== "" && Number.isFinite(parsed) ? parsed : null; }
function severityNote(row: PipelineRow): string | null {
  const width = row.width_points ?? 0;
  const stability = row.stability_points ?? 0;
  const applied = Math.min(width, stability);
  if (applied >= 0) return null;
  const reason = width <= stability ? "the fair-value range is unusually wide" : "there is limited valuation history";
  return `${Math.abs(applied)} points were deducted because ${reason}.`;
}
function statusLabel(row: PipelineRow): string {
  if (row.bank) return "Business strength not scored for banks";
  if (row.bq_status === "fail") return "Weak, did not pass key business checks";
  if (row.bq_score === null) return "Business strength not scored";
  if (row.bq_score >= 70) return `Strong, ${row.bq_score} out of 100`;
  if (row.bq_score < 40) return `Weak, ${row.bq_score} out of 100`;
  return `Mixed, ${row.bq_score} out of 100`;
}
function strengthVerdict(row: PipelineRow): string {
  if (row.bank || row.bq_score === null) return "Not scored";
  if (row.bq_status === "fail" || row.bq_score < 40) return "Weak";
  if (row.bq_score >= 70) return "Strong";
  return "Mixed";
}
function researchReason(row: PipelineRow): string {
  if (row.exclusion_code === "DATA_GAP") return "We do not have enough reliable data to estimate a value.";
  if (row.exclusion_code === "CASH_FLOW_NONPOSITIVE") return "Current cash flow does not support a fair-value estimate.";
  if (row.bq_status === "fail") return "The company did not pass one or more key business checks.";
  if (row.exclusion_code === "NOT_BELOW") return "The current price is not below our fair-value estimate.";
  return "Open the company to see the estimate and business checks.";
}
function feedStateLabel(state: string): string {
  if (state === "fresh") return "price up to date";
  if (state === "stale") return "price may be out of date";
  if (state === "error") return "price unavailable";
  return state.replaceAll("_", " ");
}
function alertKindLabel(kind: string): string {
  if (kind === "below") return "Price fell below";
  if (kind === "above") return "Price rose above";
  return "Price reached";
}
function rowTone(row: PipelineRow): string {
  if (row.bank || row.bq_score === null) return "status-neutral";
  if (row.bq_status === "fail" || row.bq_score < 40) return "status-bad";
  if (row.bq_score >= 70) return "status-good";
  return "status-neutral";
}
function unavailableText(reason: string): string {
  const copy: Record<string, string> = {
    NULL_NO_CONFIRMED_SWING: "No past price turn met the rules for this range.",
    SKIP_NO_QUALIFY: "No past price turn met the rules for this range.",
    NULL_DISTANCE_CAP: "Past price turns were too far from the current price.",
    SKIP_ORDER: "A nearer historical zone took this position.",
    SKIP_ONE_PER_RANK: "Each rank publishes at most one zone.",
    SKIP_OVERLAP: "This zone overlapped a zone that was already accepted.",
  };
  return copy[reason] ?? "Unavailable.";
}

function Icon({ name }: { name: Tab | "back" | "search" | "close" | "refresh" | "trash" }) {
  const paths: Record<string, ReactNode> = {
    picker: <><path d="M4 18V8"/><path d="M10 18V4"/><path d="M16 18v-7"/><path d="M2 18h18"/></>,
    ideas: <><path d="m3 17 5-5 4 3 7-9"/><path d="M14 6h5v5"/></>,
    watchlist: <path d="M12 18.3 5.2 22l1.3-7.7L1 8.9l7.7-1.1L12 1l3.3 6.8L23 8.9l-5.5 5.4 1.3 7.7z" transform="scale(.82) translate(2.6 1)"/>,
    screener: <><path d="M4 5h16"/><path d="M7 12h10"/><path d="M10 19h4"/></>,
    more: <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
    back: <><path d="m14 5-7 7 7 7"/><path d="M7 12h12"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4"/></>,
    close: <><path d="m6 6 12 12"/><path d="M18 6 6 18"/></>,
    refresh: <><path d="M20 6v5h-5"/><path d="M19 11a8 8 0 1 0 1 5"/></>,
    trash: <><path d="M4 7h16"/><path d="m9 7 1-3h4l1 3"/><path d="m7 7 1 13h8l1-13"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function DataBanner() { return <aside className="data-banner" aria-label="Research approach">{MODEL_SUMMARY}</aside>; }
function UniverseNote() { return <aside className="universe-note"><strong>{UNIVERSE_LABEL}</strong><span>{UNIVERSE_NOTE}</span></aside>; }
function confidenceClass(label: string): string {
  if (label === "High confidence") return "confidence-high";
  if (label === "Moderate confidence") return "confidence-moderate";
  return "confidence-low";
}
function TierTag({ tier, onClick }: { tier: Tier | null; onClick?: () => void }) {
  if (!tier) return <span className="tier-tag muted">No estimate</span>;
  const className = `tier-tag ${confidenceClass(tierLabel(tier))}`;
  return onClick ? <button type="button" className={className} onClick={onClick} aria-label={`Show stocks with a ${tierLabel(tier).toLowerCase()}`}>{tierLabel(tier)}</button> : <span className={className}>{tierLabel(tier)}</span>;
}

function MarketHero() {
  return <section className="market-hero" aria-labelledby="market-hero-title"><div className="market-hero-inner">
    <div className="market-hero-art" aria-hidden="true">
      <svg className="market-hero-motion" viewBox="0 0 460 195" role="presentation">
        <path className="infinity-track" d="M230 98 C183 39 117 27 69 55 C24 81 31 141 77 153 C128 167 183 137 230 98 C277 59 332 29 383 42 C429 54 436 114 391 140 C343 168 277 156 230 98 Z" />
        <circle className="infinity-dot" r="12">
          <animateMotion dur="4.2s" repeatCount="indefinite" path="M230 98 C183 39 117 27 69 55 C24 81 31 141 77 153 C128 167 183 137 230 98 C277 59 332 29 383 42 C429 54 436 114 391 140 C343 168 277 156 230 98 Z" />
        </circle>
      </svg>
    </div>
    <div className="market-hero-copy"><h1 id="market-hero-title">The biggest market opportunities, in a snapshot</h1><p>See stocks that look priced below what we think they're worth, and how strong each business is.</p><a className="hero-action" href="#ranked-week">See this week’s shortlist</a></div>
  </div></section>;
}

function RankedCard({ row, position, onOpen }: { row: PipelineRow; position: number; onOpen: (row: PipelineRow) => void }) {
  const gap = percentBelow(row);
  return <button className="ranked-card" onClick={() => onOpen(row)} aria-label={`Open number ${position}, ${row.ticker}, stock detail`}>
    <div className="ranked-top"><span className="rank-number">#{position}</span><span className="ranked-company"><span className="ticker-pill">{row.ticker}</span><small>{displayName(row)}</small></span><TierTag tier={row.tier} /></div>
    <div className="ranked-discount"><strong>{formatPercent(gap)}</strong><span>below our lowest fair-value estimate</span></div>
    <dl><div><dt>Current price</dt><dd>{money(row.price)}</dd><small className="price-asof">as of {dateLabel(row.price_date)}</small></div><div><dt>We think it may be worth</dt><dd>{row.range ? `${money(row.range[0])} to ${money(row.range[1])}` : "No estimate"}</dd></div><div><dt>Business strength</dt><dd className={rowTone(row)}>{statusLabel(row)}</dd></div></dl>
  </button>;
}

function UniverseRowButton({ row, onOpen }: { row: PipelineRow; onOpen: (row: PipelineRow) => void }) {
  const gap = percentBelow(row);
  return <button className={`universe-row ${row.exclusion_code === "DATA_GAP" ? "data-gap" : ""}`} onClick={() => onOpen(row)} aria-label={`Open ${row.ticker} stock detail`}>
    <span className="universe-symbol"><b>{row.ticker}</b><small>{displayName(row)}</small></span>
    <span className="universe-range"><b className={row.exclusion_code === "DATA_GAP" ? "status-neutral" : "data-value"}>{row.exclusion_code === "DATA_GAP" ? "Unable to price, data unavailable" : money(row.price)}</b>{row.price !== null ? <small className="price-asof">as of {dateLabel(row.price_date)}</small> : null}<small>{gap !== null && gap > 0 ? `${formatPercent(gap)} below our lowest estimate` : row.range ? `Fair value starts at ${money(row.range[0])}` : "No fair-value estimate"}</small></span>
    <span className="universe-score"><TierTag tier={row.tier} /><small className={rowTone(row)}>{statusLabel(row)}</small></span>
  </button>;
}

function DraftAreaRow({ area, horizonOverride }: { area: DraftArea; horizonOverride?: DraftHorizon }) {
  if (area.state === "unpublished") return <div className="draft-area-row draft-area-empty"><span>No area published right now.</span></div>;
  if (area.state === "passed") return <div className="draft-area-row draft-area-empty"><span>Passed through; no entry at this area recorded.</span></div>;
  return <div className="draft-area-row"><strong>{area.range}</strong><span className="draft-horizon">{horizonOverride ?? area.horizon}</span></div>;
}

function DraftShortlistCard({ stock }: { stock: DraftStock }) {
  const row = rowByTicker.get(stock.ticker);
  return <article className="draft-shortlist-card" aria-labelledby={`draft-${stock.ticker}-title`}>
    <header className="draft-card-header">
      <div><span className="ticker-pill">{stock.ticker}</span><span className="draft-company-name">{row ? displayName(row) : stock.ticker}</span></div>
      <span className={`tier-tag draft-confidence ${confidenceClass(stock.confidence)}`}>{stock.confidence}</span>
    </header>

    <section className="draft-verdict" aria-label="One-glance verdict">
      <h2 id={`draft-${stock.ticker}-title`}>Priced below the low end of our estimated range.</h2>
      <div className="draft-price-line"><div><span>Price</span><strong>{money(stock.price)}</strong><small>Price as of 25 Sep 2026.</small></div></div>
      <dl className="draft-glance-facts"><div><dt>Estimated range</dt><dd>{money(stock.range[0])}–{money(stock.range[1])}</dd></div></dl>
    </section>

    <div className="draft-decision-grid">
      <section className="draft-score-panel" aria-label="Business quality score"><span>Business quality</span><strong>{stock.quality}</strong><small>out of 100</small></section>
      <section className="draft-areas" aria-labelledby={`draft-${stock.ticker}-areas`}>
        <div className="draft-section-heading"><h3 id={`draft-${stock.ticker}-areas`}>Price areas to watch</h3><p>The nearest buy and sell areas are shown first.</p></div>
        <div className="draft-area-group"><h4>Buy area</h4><DraftAreaRow area={stock.buy[0]} horizonOverride="Close by"/><p>This is a price area to watch, not a signal to buy now. Some investors wait for a dip like this before buying. Reaching the area is not a reason to buy.</p></div>
        <div className="draft-area-group"><h4>Taking profit</h4><DraftAreaRow area={stock.sell[0]} horizonOverride="Close by"/><p>This is a price area to watch for taking some profit. Based on modest evidence. Not a forecast. Not a top, not a target; selling is optional.</p></div>
        <p className="draft-scale-guard">These are alternative areas to consider, not steps in a plan to buy three times. No purchase is required at any area.</p>
        <details className="draft-more-areas"><summary><span>Learn more</span><small>See the remaining buy and sell levels</small></summary><div className="draft-hidden-areas"><div className="draft-hidden-group"><h4>More buy areas</h4>{stock.buy.slice(1).map((area, index) => <DraftAreaRow key={`buy-${index}`} area={area}/>)}</div><div className="draft-hidden-group"><h4>More taking-profit areas</h4>{stock.sell.slice(1).map((area, index) => <DraftAreaRow key={`sell-${index}`} area={area}/>)}</div></div></details>
      </section>
    </div>

    <section className="draft-why"><h3>Why this is here</h3><p>Only companies priced below the lowest figure in their estimated range make the shortlist.</p></section>
    <section className="draft-details" aria-label="Business and valuation details"><div><h3>Business strength</h3><strong>{stock.quality} out of 100</strong><p>The score comes from the company’s filed accounts and checks cash, debt, growth and profitability.</p></div><div><h3>Valuation confidence</h3><strong className={confidenceClass(stock.confidence)}>{stock.confidence}</strong><p>The label shows how confident we are in the estimated range. A narrower range carries more confidence.</p></div></section>
    <details className="draft-method"><summary>How these areas are found</summary><p>Past price ranges show places where the share price changed direction before. They do not predict what happens next.</p></details>
  </article>;
}

function DraftShortlistScreen({ onBack }: { onBack: () => void }) {
  return <div className="screen draft-screen">
    <button className="text-button back-link" type="button" onClick={onBack}><Icon name="back"/>Back to shortlist</button>
    <aside className="draft-banner">DRAFT — for review only, not the live shortlist</aside>
    <header className="draft-page-intro"><h1>Redesigned shortlist cards</h1><p>A review screen for the current three-stock shortlist.</p></header>
    <div className="draft-card-list">{DRAFT_SHORTLIST.map((stock) => <DraftShortlistCard key={stock.ticker} stock={stock}/>)}</div>
  </div>;
}

function PickerScreen({ onOpen, onOpenDraft }: { onOpen: (row: PipelineRow) => void; onOpenDraft: () => void }) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(70);
  const [shortlistSort, setShortlistSort] = useState<PickerSort>("strength");
  const term = query.trim().toUpperCase();
  const source = term ? allRows : universeRows;
  const filtered = useMemo(() => source.filter((row) => !term || row.ticker.includes(term) || displayName(row).toUpperCase().includes(term)), [source, term]);
  const visible = filtered.slice(0, limit);
  const shortlistRows = useMemo(() => [...rankedRows].sort((a, b) => {
    if (shortlistSort === "discount") return (percentBelow(b) ?? -Infinity) - (percentBelow(a) ?? -Infinity) || (b.bq_score ?? -1) - (a.bq_score ?? -1) || a.ticker.localeCompare(b.ticker);
    return (b.bq_score ?? -1) - (a.bq_score ?? -1) || (percentBelow(b) ?? -Infinity) - (percentBelow(a) ?? -Infinity) || a.ticker.localeCompare(b.ticker);
  }), [shortlistSort]);
  useEffect(() => setLimit(70), [term]);
  return <div className="screen picker-screen">
    <MarketHero />
    <section id="ranked-week" className="ranked-section" aria-labelledby="ranked-title">
      <div className="section-heading"><div><h2 id="ranked-title">This week’s shortlist</h2><p>Stocks trading for less than we think they are worth. Choose what matters most to you.</p></div></div>
      <button className="secondary-button draft-preview-button" type="button" onClick={onOpenDraft}>How to read the data</button>
      <div className="shortlist-preamble">
        <p><strong className="preamble-value">Fair-value range</strong> estimates what one share may be worth. <strong className="preamble-confidence">Confidence</strong> shows how much we trust it.</p>
        <p>Only stocks priced <strong className="preamble-value">below the range low</strong> appear here. Prices are dated 25 Sep 2026; the list refreshes Mondays.</p>
      </div>
      <fieldset className="shortlist-sort">
        <legend>Rank the shortlist by</legend>
        <div>
          <button type="button" className={shortlistSort === "strength" ? "selected" : ""} aria-pressed={shortlistSort === "strength"} onClick={() => setShortlistSort("strength")}><strong>Business strength</strong><span>Healthier businesses first</span></button>
          <button type="button" className={shortlistSort === "discount" ? "selected" : ""} aria-pressed={shortlistSort === "discount"} onClick={() => setShortlistSort("discount")}><strong>Biggest discount</strong><span>Furthest below fair value first</span></button>
        </div>
      </fieldset>
      <p className="shortlist-order" aria-live="polite">Now ranked by <strong>{shortlistSort === "strength" ? "business strength" : "biggest discount"}</strong>.</p>
      <div className="ranked-grid">{shortlistRows.map((row, index) => <RankedCard key={row.ticker} row={row} position={index + 1} onOpen={onOpen} />)}</div>
    </section>
    <section className="universe-section" aria-labelledby="universe-title">
      <div className="section-heading"><div><h2 id="universe-title">Explore all stocks</h2><p>Search 305 large US companies outside finance. You can also search for a bank by its ticker.</p></div><span>{universeRows.length} companies</span></div>
      <UniverseNote />
      <label className="search-input" htmlFor="picker-search"><Icon name="search"/><input id="picker-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by company or ticker" aria-label="Search by company or ticker" /></label>
      <div className="result-count">{filtered.length} {term ? "matches" : "companies"}</div>
      <div className="universe-list">{visible.map((row) => <UniverseRowButton key={row.ticker} row={row} onOpen={onOpen} />)}</div>
      {visible.length < filtered.length ? <button className="secondary-button load-more" onClick={() => setLimit((value) => value + 70)}>Show {Math.min(70, filtered.length - visible.length)} more</button> : null}
      {filtered.length === 0 ? <div className="empty-state"><h2>No matches</h2><p>Try another US ticker.</p></div> : null}
    </section>
  </div>;
}

function ChecklistGlyph({ status }: { status: ChecklistStatus }) {
  const reactId = useId();
  const clipId = `check-half-${reactId.replace(/:/g, "")}`;
  if (status === "no_data") return <span className="no-data-glyph status-neutral" aria-label="No data">&minus;</span>;
  if (status === "pass") return <svg className="checklist-glyph" viewBox="0 0 30 30" role="img" aria-label="Passed"><circle cx="15" cy="15" r="13" fill="#2e7d4f"/><path d="M10 15.5l3.5 3.5L20.5 12" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (status === "partial") return <svg className="checklist-glyph" viewBox="0 0 30 30" role="img" aria-label="Partially passed"><defs><clipPath id={clipId}><rect x="2" y="2" width="13" height="26"/></clipPath></defs><circle cx="15" cy="15" r="13" fill="#fff4df" stroke="#b06f12" strokeWidth="2"/><g clipPath={`url(#${clipId})`}><circle cx="15" cy="15" r="13" fill="#b06f12"/></g><circle cx="15" cy="15" r="13" fill="none" stroke="#b06f12" strokeWidth="2"/></svg>;
  return <svg className="checklist-glyph" viewBox="0 0 30 30" role="img" aria-label="Did not pass"><circle cx="15" cy="15" r="13" fill="#fdecee" stroke="#c43d45" strokeWidth="2"/><path d="m10.5 10.5 9 9m0-9-9 9" stroke="#c43d45" strokeWidth="2.3" strokeLinecap="round"/></svg>;
}
function ExpandGlyph({ expanded }: { expanded: boolean }) { return <svg className="checklist-glyph" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="13" fill="none" stroke="#8e8e93" strokeWidth="2"/>{!expanded ? <line x1="15" y1="9" x2="15" y2="21" stroke="#141414" strokeWidth="2.5" strokeLinecap="round"/> : null}<line x1="9" y1="15" x2="21" y2="15" stroke="#141414" strokeWidth="2.5" strokeLinecap="round"/></svg>; }
function BusinessHealthChecks({ row }: { row: ChecklistRow }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => [...row.checks].sort((a, b) => a.id - b.id), [row.checks]);
  return <section className="business-checklist" aria-labelledby="business-health-title">
    <DataBanner />
    <button className="checklist-header" type="button" aria-expanded={expanded} aria-controls="business-health-content" onClick={() => setExpanded((value) => !value)}>
      <span className="checklist-head-text"><span id="business-health-title" className="checklist-head-title">Business health</span><span className="checklist-head-total">{row.total} out of {row.live_checks * 10} points</span></span><ExpandGlyph expanded={expanded}/>
    </button>
    {expanded ? <div id="business-health-content" className="checklist-content">
      <p className="checklist-sub">These checks look at growth, profit, cash and debt to show how strong the business appears.</p>
      <p className="checklist-asof">Share-price checks ran on 27 Sep 2026 using prices as of 25 Sep 2026. Business checks use the company’s latest filed financial years.</p>
      <div className="checklist-rows">{sorted.map((check) => <div className={`checklist-row ${check.status === "pass" ? "status-good" : check.status === "fail" ? "status-bad" : "status-neutral"} ${check.status === "no_data" ? "muted" : ""}`} key={check.id}><div className="checklist-copy"><div className="checklist-title">{check.title}</div><div className="checklist-evidence">{check.status === "no_data" ? "No result because company data is missing." : check.value_display}</div><div className="checklist-why">{check.tells}</div></div><ChecklistGlyph status={check.status}/></div>)}</div>
      <p className="checklist-honesty">These checks describe the business. They are not a recommendation to buy or sell.</p>
    </div> : null}
  </section>;
}

function TimingStrip({ stock, onOpen }: { stock: LevelStock; onOpen: (selection: LevelSelection) => void }) {
  const published = ranks.flatMap((rank) => (["buy", "sell"] as Side[]).flatMap((side) => { const level = stock[side][rank]; return isPublished(level) ? [{ side, rank, level }] : []; }));
  const values = [stock.last_close, ...published.flatMap((item) => [item.level.lower, item.level.upper])];
  const rawMin = Math.min(...values); const rawMax = Math.max(...values);
  const position = (value: number) => `${Math.max(5, Math.min(95, rawMax === rawMin ? 50 : ((value - rawMin) / (rawMax - rawMin)) * 90 + 5))}%`;
  return <div className="timing-strip-wrap"><div className="strip-meta"><span>{stock.ticker}</span><span>Past price ranges, {dateLabel(stock.asof)}</span><span className="strip-last-price"><b>Last price {money(stock.last_close)}</b><small>as of {dateLabel(stock.last_date)}</small></span></div><div className="timing-strip" aria-label={`Past price ranges around ${stock.ticker} last price`}><div className="rail"/>{published.map((item) => <button key={`${item.side}-${item.rank}`} className={`rail-marker ${item.side}`} style={{ left: position(item.level.anchor) }} onClick={() => onOpen(item)} aria-label={`Open ${rankLabel(item.side, item.rank)} level at ${money(item.level.anchor)}`}><span>{rankLabel(item.side, item.rank)}</span><small>{money(item.level.anchor)}</small></button>)}<div className="last-close-marker" style={{ left: position(stock.last_close) }}><span><b>Last price {money(stock.last_close)}</b><small>as of {dateLabel(stock.last_date)}</small></span></div></div><div className="strip-scale"><span>{money(rawMin)}</span><span>{money(rawMax)}</span></div></div>;
}
function LevelCard({ side, rank, level, onOpen }: { side: Side; rank: Rank; level: Level; onOpen: (selection: LevelSelection) => void }) {
  if (!isPublished(level)) return <article className="level-card unavailable"><div><b>{rankLabel(side, rank)}</b><span>Unavailable</span></div><p>{unavailableText(level.null_reason)}</p></article>;
  return <button className={`level-card published ${side}`} onClick={() => onOpen({ side, rank, level })}><div><b>{rankLabel(side, rank)}</b><span>{level.dist_atr.toFixed(2)} typical daily price moves away</span></div><strong>{money(level.lower)} to {money(level.upper)}</strong><p>Based on a price turn from {dateLabel(level.anchor_date)}</p></button>;
}
function HistoricalLevels({ stock }: { stock: LevelStock | undefined }) {
  const [selection, setSelection] = useState<LevelSelection | null>(null);
  if (!stock) return <section className="detail-section"><div className="section-heading compact"><div><h2>Past price ranges</h2><p>We do not have a past price range for this stock.</p></div></div></section>;
  return <section className="detail-section"><div className="section-heading compact"><div><h2>Past price ranges</h2><p>Places where this stock changed direction before.</p></div></div><TimingStrip stock={stock} onOpen={setSelection}/><p className="honesty-line">These are past patterns, not predictions or instructions.</p><div className="level-columns"><section><h3>Below the last price</h3><div className="level-list">{ranks.map((rank) => <LevelCard key={rank} side="buy" rank={rank} level={stock.buy[rank]} onOpen={setSelection}/>)}</div></section><section><h3>Above the last price</h3><div className="level-list">{ranks.map((rank) => <LevelCard key={rank} side="sell" rank={rank} level={stock.sell[rank]} onOpen={setSelection}/>)}</div></section></div>{selection ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelection(null); }}><section className="level-dialog" role="dialog" aria-modal="true" aria-labelledby="level-title"><div className="dialog-head"><h2 id="level-title">{rankLabel(selection.side, selection.rank)} range</h2><button aria-label="Close level details" onClick={() => setSelection(null)}><Icon name="close"/></button></div><dl className="facts-grid"><div><dt>Range</dt><dd>{money(selection.level.lower)} to {money(selection.level.upper)}</dd></div><div><dt>Reference price</dt><dd>{money(selection.level.anchor)}<small className="price-asof">as of {dateLabel(selection.level.anchor_date)}</small></dd></div><div><dt>Price turn began</dt><dd>{dateLabel(selection.level.anchor_date)}</dd></div><div><dt>Price turn confirmed</dt><dd>{dateLabel(selection.level.confirmed)}</dd></div></dl><button className="secondary-button" onClick={() => setSelection(null)}>Close</button></section></div> : null}</section>;
}

function QualityCard({ row }: { row: PipelineRow }) {
  const note = severityNote(row);
  return <section className="quality-card"><div><span>Business strength</span><strong className={rowTone(row)}>{row.bank ? "Not available" : row.bq_score === null ? "Not available" : `${row.bq_score}/100`}</strong></div><div><b className={rowTone(row)}>{strengthVerdict(row)}</b>{note ? <p>{note}</p> : null}<p>{researchReason(row)}</p>{row.bq_fail_codes.length > 0 ? <p>The company did not pass {row.bq_fail_codes.length} key {row.bq_fail_codes.length === 1 ? "check" : "checks"}.</p> : null}</div></section>;
}
function DetailScreen({ row, watched, onBack, onAdd, onTierFilter }: { row: PipelineRow; watched: boolean; onBack: () => void; onAdd: () => Promise<void>; onTierFilter: (tier: Tier) => void }) {
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState(""); const checklist = checklistByTicker.get(row.ticker); const stock = levels[row.ticker]; const gap = percentBelow(row); const note = severityNote(row);
  async function add() { if (watched || saving) return; setSaving(true); setMessage(""); try { await onAdd(); setMessage("Added to watchlist."); } catch { setMessage("Could not add this stock. Please try again."); } finally { setSaving(false); } }
  return <div className="screen detail-screen"><button className="text-button back-link" onClick={onBack}><Icon name="back"/>Back</button><DataBanner/><header className="stock-header"><div><span className="ticker-pill">{row.ticker}</span><h1>{displayName(row)}</h1></div><div className="close-quote"><span>Price</span><strong>{money(row.price)}</strong><small>as of {dateLabel(row.price_date)}</small></div></header>
    <section className="valuation-card" aria-label={`${row.ticker} fair-value estimate`}><div className="card-label"><span>What we think one share may be worth</span><TierTag tier={row.tier} onClick={row.tier ? () => onTierFilter(row.tier as Tier) : undefined}/></div><strong className="data-value">{row.range ? `${money(row.range[0])} to ${money(row.range[1])}` : "Unable to price, data unavailable"}</strong><div className="valuation-facts"><span><small>Current price</small><b className="data-value">{money(row.price)}</b><small className="price-asof">as of {dateLabel(row.price_date)}</small></span><span><small>Compared with our lowest estimate</small><b className="data-value">{gap === null ? "No data" : gap >= 0 ? `${formatPercent(gap)} lower` : `${formatPercent(Math.abs(gap))} higher`}</b></span><span><small>Estimate date</small><b>{dateLabel(row.range_as_of)}</b></span></div>{note ? <p>{note}</p> : null}</section>
    {row.card_lines.length > 0 ? <aside className="wide-swing">Wide-swing cash flows, this range is looser than most</aside> : null}
    {checklist ? <BusinessHealthChecks row={checklist}/> : <p className="status-panel">No business health checklist is available.</p>}
    <HistoricalLevels stock={stock}/><QualityCard row={row}/>
    <button className="primary-button" onClick={() => void add()} disabled={watched || saving}>{watched ? "In watchlist" : saving ? "Adding…" : "Add to watchlist"}</button><p className="watchlist-helper">After adding, set the price that triggers an alert on the watchlist card.</p>{message ? <p className="action-message" role="status">{message}</p> : null}<p className="detail-source">Current price dated {dateLabel(row.price_date)}. Fair-value estimate dated {dateLabel(row.range_as_of)}.</p>
  </div>;
}

function levelCode(side: Side, rank: Rank): LevelCode { return `${side === "buy" ? "B" : "S"}${rank.slice(1)}` as LevelCode; }
function levelMidpoint(level: PublishedLevel): number { return (level.lower + level.upper) / 2; }
function hitRateFor(symbol: string, side: Side, rank: Rank): HitRate | undefined { return hitRates.symbols[symbol]?.[levelCode(side, rank)]; }
function ideaHitRateLabel(level: IdeaTradeLevel | null, short = false): string {
  if (!level || level.rate === null || level.hits === null || level.cases < 8) return "";
  return short ? `${level.rate}%` : `Probability from history: ${level.rate}%, ${level.hits} of the last ${level.cases}`;
}
function IdeaLevelRow({ side, level, index }: { side: Side; level: IdeaTradeLevel | null; index: number }) {
  const label = `${side === "buy" ? "Buy" : "Sell"} ${index + 1}`;
  if (!level) return <div className="idea-level-row unavailable"><span>{label}</span><strong>Unavailable</strong><small>No calculated level for this setup.</small></div>;
  const historyLabel = ideaHitRateLabel(level);
  return <div className={`idea-level-row ${side}`}><span>{label}</span><strong>{money(level.value)}</strong>{historyLabel ? <small>{historyLabel}</small> : null}<p>{side === "buy" ? "price area to watch, not a signal to buy now" : "profit-taking marker, not a forecast"}</p>{side === "sell" ? <em>Based on modest evidence.</em> : null}</div>;
}

function rangeDays(range: ChartRange): number { return range === "1W" ? 7 : range === "1M" ? 31 : range === "3M" ? 93 : range === "1Y" ? 366 : 1827; }
function fallbackTradeLevels(symbol: string, side: Side): IdeaTradeLevel[] {
  const stock = levels[symbol];
  return ranks.flatMap((rank, index) => {
    const level = stock?.[side][rank]; if (!level || !isPublished(level)) return [];
    const rate = hitRateFor(symbol, side, rank);
    return [{ label: `${side === "buy" ? "Buy" : "Sell"} ${index + 1}`, value: levelMidpoint(level), cases: rate?.cases ?? 0, hits: rate?.hits ?? null, rate: rate?.rate ?? null }];
  });
}
function IdeaPriceChart({ idea }: { idea: WeeklyIdea }) {
  const [range, setRange] = useState<ChartRange>("1Y"); const [showMarket, setShowMarket] = useState(false); const [inspectMode, setInspectMode] = useState(false); const [inspectIndex, setInspectIndex] = useState<number | null>(null);
  const allHistory = idea.history; const lastPoint = allHistory.at(-1); const cutoff = lastPoint ? new Date(`${lastPoint.date}T00:00:00Z`).getTime() - rangeDays(range) * 86400000 : 0;
  const history = allHistory.filter((point) => new Date(`${point.date}T00:00:00Z`).getTime() >= cutoff);
  const benchmarkRaw = idea.benchmark.filter((point) => new Date(`${point.date}T00:00:00Z`).getTime() >= cutoff);
  if (history.length < 2) return <div className="chart-empty">Recent price history is unavailable for this match.</div>;
  const width = 760; const height = 500; const left = 68; const right = 20; const top = 24; const bottom = 74;
  const first = history[0]; const benchmarkFirst = benchmarkRaw[0];
  const benchmark = showMarket && first && benchmarkFirst ? benchmarkRaw.map((point) => ({ date: point.date, close: first.close * (point.close / benchmarkFirst.close) })) : [];
  const values = [...history.map((point) => point.close), ...benchmark.map((point) => point.close), idea.close];
  const rawMin = Math.min(...values); const rawMax = Math.max(...values); const pad = Math.max((rawMax - rawMin) * .08, rawMax * .012); const min = rawMin - pad; const max = rawMax + pad;
  const x = (index: number, count = history.length) => left + (index / Math.max(1, count - 1)) * (width - left - right);
  const y = (value: number) => top + ((max - value) / Math.max(.01, max - min)) * (height - top - bottom);
  const points = history.map((point, index) => `${x(index).toFixed(1)},${y(point.close).toFixed(1)}`).join(" ");
  const marketPoints = benchmark.map((point, index) => `${x(index, benchmark.length).toFixed(1)},${y(point.close).toFixed(1)}`).join(" ");
  const area = `${left},${height - bottom} ${points} ${width - right},${height - bottom}`;
  const yTicks = [0, 1, 2, 3, 4].map((step) => min + ((max - min) * step) / 4);
  const longRange = range === "1Y" || range === "5Y";
  const xFractions = range === "5Y" ? [0, .5, 1] : range === "1Y" ? [0, 1 / 3, 2 / 3, 1] : [0, .25, .5, .75, 1];
  const xIndexes = [...new Set(xFractions.map((value) => Math.round((history.length - 1) * value)))];
  const start = history[0]; const end = history.at(-1); const stockReturn = start && end ? ((end.close / start.close) - 1) * 100 : null;
  const marketStart = benchmarkRaw[0]; const marketEnd = benchmarkRaw.at(-1); const marketReturn = marketStart && marketEnd ? ((marketEnd.close / marketStart.close) - 1) * 100 : null;
  const change = idea.setupDetail?.change ?? 0; const changePercent = idea.setupDetail?.changePercent ?? 0;
  const selectedIndex = inspectIndex === null ? history.length - 1 : Math.max(0, Math.min(history.length - 1, inspectIndex));
  const selectedPoint = history[selectedIndex];
  const selectedX = x(selectedIndex); const selectedY = selectedPoint ? y(selectedPoint.close) : 0;
  const tooltipOnRight = selectedX < width * .58; const tooltipWidth = 190; const tooltipHeight = 70; const tooltipX = tooltipOnRight ? Math.min(selectedX + 16, width - right - tooltipWidth) : Math.max(left, selectedX - tooltipWidth - 16); const tooltipY = selectedPoint ? Math.max(top + 8, Math.min(selectedY - 78, height - bottom - tooltipHeight - 8)) : top;
  function inspectAt(event: PointerEvent<SVGSVGElement>) {
    if (!inspectMode) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const chartX = ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * width;
    const nextIndex = Math.round(((chartX - left) / Math.max(1, width - left - right)) * (history.length - 1));
    setInspectIndex(Math.max(0, Math.min(history.length - 1, nextIndex)));
  }
  function changeRange(nextRange: ChartRange) { setRange(nextRange); setInspectIndex(null); }
  return <section className="idea-chart" aria-label={`${idea.symbol} price chart`}><div className="chart-quote-row"><div><span className="chart-company">{idea.name}</span><strong>{money(idea.close)}</strong><small className={change >= 0 ? "positive-change" : "negative-change"}>{change >= 0 ? "+" : ""}{money(change)} ({changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%)</small></div><div className="chart-actions"><div className="timeframe-pills" role="group" aria-label="Chart timeframe">{(["1W", "1M", "3M", "1Y", "5Y"] as ChartRange[]).map((item) => <button type="button" key={item} className={range === item ? "selected" : ""} aria-pressed={range === item} onClick={() => changeRange(item)}>{item}</button>)}</div><div className="chart-action-row"><button type="button" className={`inspect-price-button ${inspectMode ? "selected" : ""}`} aria-pressed={inspectMode} onClick={() => { setInspectMode((current) => !current); setInspectIndex(null); }}>{inspectMode ? "Done checking" : "Check a price"}</button><label className="market-toggle"><input type="checkbox" checked={showMarket} onChange={(event) => setShowMarket(event.target.checked)}/><span>vs. the market</span></label></div></div></div>{inspectMode ? <p className="inspect-hint">Tap the trend line or drag the slider to check a date and price.</p> : null}<svg className={`${longRange ? "chart-long-range" : "chart-short-range"} ${inspectMode ? "chart-inspecting" : ""}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${idea.symbol} price trend${showMarket ? " with S&P 500 comparison" : ""}`} onPointerDown={inspectAt}>
    <defs><linearGradient id={`area-${idea.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#198a56" stopOpacity=".24"/><stop offset="1" stopColor="#198a56" stopOpacity=".015"/></linearGradient></defs>
    {yTicks.map((tick) => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className="chart-grid"/><text x={left - 8} y={y(tick) + 3} textAnchor="end" className="chart-axis">{money(tick).replace("$", "")}</text></g>)}
    {xIndexes.map((index) => <line key={`vertical-${index}`} x1={x(index)} x2={x(index)} y1={top} y2={height - bottom} className="chart-grid"/>)}
    <polygon points={area} fill={`url(#area-${idea.id})`}/><polyline points={points} className="chart-price-line"/>{showMarket && marketPoints ? <polyline points={marketPoints} className="chart-market-line"/> : null}
    <circle cx={x(history.length - 1)} cy={y(idea.close)} r="6" className="chart-current"/>
    {inspectMode && selectedPoint ? <g className="chart-inspector"><line x1={selectedX} x2={selectedX} y1={top} y2={height - bottom} className="chart-inspector-line"/><circle cx={selectedX} cy={selectedY} r="9" className="chart-inspector-point"/><rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} rx="8" className="chart-inspector-card"/><text x={tooltipX + 14} y={tooltipY + 26} className="chart-inspector-date">{chartDateLabel(selectedPoint.date, true)}</text><text x={tooltipX + 14} y={tooltipY + 54} className="chart-inspector-price">{money(selectedPoint.close)}</text></g> : null}
    {xIndexes.map((index) => { const point = history[index]; return point ? <text key={`${index}-${point.date}`} x={x(index)} y={height - 22} textAnchor={index === 0 ? "start" : index === history.length - 1 ? "end" : "middle"} className="chart-axis chart-date-axis">{chartDateLabel(point.date, longRange)}</text> : null; })}
  </svg>{inspectMode && selectedPoint ? <div className="chart-scrubber"><div aria-live="polite"><span>{chartDateLabel(selectedPoint.date, true)}</span><strong>{money(selectedPoint.close)}</strong></div><input type="range" min="0" max={Math.max(0, history.length - 1)} value={selectedIndex} onChange={(event) => setInspectIndex(Number(event.target.value))} aria-label={`Choose a date on the ${idea.symbol} price chart`}/></div> : null}<div className="chart-return-summary"><span><b>{range} return</b><strong className={(stockReturn ?? 0) >= 0 ? "positive-change" : "negative-change"}>{stockReturn === null ? "No data" : `${stockReturn >= 0 ? "+" : ""}${stockReturn.toFixed(1)}%`}</strong></span>{showMarket ? <span><b>S&amp;P 500</b><strong>{marketReturn === null ? "No data" : `${marketReturn >= 0 ? "+" : ""}${marketReturn.toFixed(1)}%`}</strong></span> : null}<small>S&amp;P 500 is rebased to the stock’s starting price for comparison.</small></div></section>;
}

function SizingHelper({ idea, buyLevels }: { idea: WeeklyIdea; buyLevels: IdeaTradeLevel[] }) {
  const [capitalText, setCapitalText] = useState("1000"); const [split, setSplit] = useState<[number, number, number]>([34, 33, 33]);
  const capital = Number(capitalText); const validCapital = Number.isFinite(capital) && capital > 0; const splitTotal = split.reduce((sum, value) => sum + value, 0); const validSplit = splitTotal === 100;
  const buys = [buyLevels[0] ?? null, buyLevels[1] ?? null, buyLevels[2] ?? null];
  const presets: Array<{ label: string; values: [number, number, number] }> = [{ label: "Even thirds", values: [34, 33, 33] }, { label: "Start smaller", values: [20, 40, 40] }, { label: "Front-load", values: [50, 30, 20] }];
  const expected = validSplit && buys.every((level, index) => (split[index] ?? 0) === 0 || level?.rate !== null) ? split.reduce((sum, value, index) => sum + value * ((buys[index]?.rate ?? 0) / 100), 0) : null;
  function scenario(count: number) { if (!validCapital || !validSplit) return null; const included = buys.slice(0, count); if (included.some((level, index) => (split[index] ?? 0) > 0 && !level)) return null; const deployed = included.reduce((sum, level, index) => sum + (level ? capital * (split[index] ?? 0) / 100 : 0), 0); const shares = included.reduce((sum, level, index) => sum + (level ? (capital * (split[index] ?? 0) / 100) / level.value : 0), 0); return { deployed, average: shares > 0 ? deployed / shares : null, undeployed: capital - deployed }; }
  return <section className="sizing-helper" aria-label={`${idea.symbol} sizing helper`}><div className="idea-section-heading"><h3>Trade sizing</h3><p>Enter the capital you are considering. The split is your choice, not a recommendation.</p></div><div className="sizing-inputs"><label><span>Capital</span><span className="money-input"><b>$</b><input aria-label={`${idea.symbol} capital`} inputMode="decimal" type="number" min="1" value={capitalText} onChange={(event) => setCapitalText(event.target.value)}/></span></label><fieldset><legend>Split across Buy 1, Buy 2 and Buy 3</legend><div className="split-inputs">{split.map((value, index) => <label key={index}><span>B{index + 1}</span><input aria-label={`${idea.symbol} Buy ${index + 1} split percentage`} type="number" min="0" max="100" value={value} onChange={(event) => setSplit((current) => { const next = [...current] as [number, number, number]; next[index] = Math.max(0, Math.min(100, Number(event.target.value) || 0)); return next; })}/><small>%</small></label>)}</div>{!validSplit ? <p className="split-error" role="status">Your split totals {splitTotal}%. Set it to 100% to see the scenarios.</p> : null}</fieldset></div><div className="sizing-presets">{presets.map((preset) => <button key={preset.label} type="button" onClick={() => setSplit(preset.values)}>{preset.label}</button>)}</div>
    {validCapital && validSplit ? <><div className="deployment-grid">{buys.map((level, index) => <div key={index}><span>Buy {index + 1}</span><strong>{level ? money(capital * (split[index] ?? 0) / 100) : "No level"}</strong><small>{level ? `near ${money(level.value)}` : "Stays undeployed"}</small></div>)}</div><div className="scenario-list">{[1, 2, 3].map((count) => { const result = scenario(count); return <div key={count} className="scenario-row"><span>Price reaches Buy {count}</span>{result ? <><span><small>Average entry</small><strong>{result.average === null ? "No deployment" : money(result.average)}</strong></span><span><small>Cash left</small><strong>{money(result.undeployed)}</strong></span></> : <strong>Unavailable</strong>}</div>; })}</div>{expected !== null ? <p className="expected-deployment">Expected deployed fraction from the historical touch rates: <strong>{expected.toFixed(1)}% ({money(capital * expected / 100)} of {money(capital)})</strong></p> : null}</> : null}
    <p className="sizing-note">Reaching Buy 3 includes Buy 1 and Buy 2. Historical touch rates describe past 63-session windows. They do not predict the next trade.</p></section>;
}

function WeeklyIdeasScreen({ run, ideas, loading, error, refreshing, onRefresh, onOpen }: { run: WeeklyIdeaRun; ideas: WeeklyIdea[]; loading: boolean; error: string; refreshing: boolean; onRefresh: () => Promise<void>; onOpen: (row: PipelineRow) => void }) {
  return <div className="screen ideas-screen">
    <header className="ideas-intro"><div><p className="ideas-kicker">Weekly trade ideas</p><h1>Strong technical setups, with the levels mapped out</h1><p>Up to five liquid US stocks, ranked across three objective patterns. Every refresh checks the next seven calendar days of earnings first, so a stock stays off the list until after its report.</p></div><button className="secondary-button ideas-refresh" type="button" onClick={() => void onRefresh()} disabled={refreshing}>{refreshing ? "Checking prices and earnings…" : "Refresh trade ideas"}</button></header>
    <section className="pattern-rule" aria-labelledby="pattern-rule-title"><h2 id="pattern-rule-title">What qualifies for the list</h2><ol className="setup-rule-list"><li><strong>Fresh breakout.</strong><span>The stock has just moved above its highest price of the past year, with at least 1.25 times its normal trading value.</span></li><li><strong>Healthy pullback.</strong><span>The stock has risen over the past three months, its 50-day average is still rising, and the price dipped close to that average without breaking the trend.</span></li><li><strong>Strong momentum.</strong><span>The stock is among the market’s strongest performers over three months, but sits no more than 10% above its rising 50-day average so it is not too stretched.</span></li><li><strong>Easy enough to trade.</strong><span>The share price is above $5 and at least $20 million of the stock usually changes hands each day.</span></li><li><strong>No earnings within seven days.</strong><span>A technical match is held back when its company is scheduled to report earnings from the scan date through seven calendar days ahead. It can qualify again after the report.</span></li><li><strong>Best balance wins.</strong><span>Stocks are ranked by strength, with a penalty for prices that have already run too far. The five highest earnings-cleared scores make the weekly list.</span></li></ol><p className="setup-guard">A stock only needs to match one of the first three patterns, but it must also pass the trading checks. If several ideas come from the same industry, that means the list is concentrated in one part of the market.</p></section>
    {run ? <div className="ideas-status"><span>Prices through {dateLabel(run.asOfDate)}</span><span>{run.quoteCount} of {run.universeCount} companies checked</span><span>{run.matchCount} earnings-cleared setups</span>{run.earningsCheckedThrough ? <span className="earnings-status">Earnings checked through {dateLabel(run.earningsCheckedThrough)}</span> : null}<span>{run.earningsExcludedCount} held back for earnings</span></div> : null}
    {run?.note ? <p className="ideas-note">{run.note}</p> : null}
    {loading ? <div className="status-panel">Loading trade ideas…</div> : error ? <div className="status-panel error">{error}</div> : ideas.length === 0 ? <div className="empty-state ideas-empty"><h2>No qualifying trade ideas yet</h2><p>{run ? "No stock passed any of the three setup rules in the latest scan." : "Refresh to scan the current market."}</p></div> : <div className="ideas-list">{ideas.map((idea) => {
      const row = rowByTicker.get(idea.symbol); const detail = idea.setupDetail;
      const buyLevels = detail?.buyLevels ?? fallbackTradeLevels(idea.symbol, "buy"); const sellLevels = detail?.sellLevels ?? fallbackTradeLevels(idea.symbol, "sell");
      const setupLabel = detail?.label ?? (idea.setup === "trend_pullback" ? "Trend pullback" : idea.setup === "momentum_leader" ? "Momentum leader" : "Breakout");
      return <article className="idea-entry" key={idea.id}><details><summary className="idea-entry-head"><span className="idea-rank">0{idea.rank}</span><div><span className="idea-symbol">{idea.symbol}</span><h2>{idea.name}</h2><small>{setupLabel} · {run?.earningsCheckedThrough ? "Earnings clear for seven days" : "Earnings check required"} · Open chart and levels</small></div><div className="idea-volume"><strong>{detail ? `${detail.threeMonthReturn >= 0 ? "+" : ""}${detail.threeMonthReturn.toFixed(1)}%` : `${idea.volumeMultiple.toFixed(2)}×`}</strong><span>{detail ? "3 months" : "volume"}</span></div></summary><div className="idea-expanded">
        <div className="idea-thesis"><span className="setup-name">{setupLabel}</span><p>{detail?.explanation ?? `Closed above the prior 52-week high of ${money(idea.prior52WeekHigh)}.`}</p><dl>{detail ? <><div><dt>From 50-day average</dt><dd>{detail.distanceFromSma50 >= 0 ? "+" : ""}{detail.distanceFromSma50.toFixed(1)}%</dd></div><div><dt>Typical daily move</dt><dd>{money(detail.atr14)}</dd></div></> : <div><dt>Volume</dt><dd>{idea.volumeMultiple.toFixed(2)}× normal</dd></div>}</dl><small>Close as of {dateLabel(idea.asOfDate)}. Setup rules use prices and trading volume only.</small>{run?.earningsCheckedThrough ? <small className="earnings-clear-note">No earnings scheduled through {dateLabel(run.earningsCheckedThrough)}.</small> : null}</div>
        <IdeaPriceChart idea={idea}/>
        <section className="idea-levels" aria-label={`${idea.symbol} buy and sell levels`}><div className="idea-levels-head"><h3>Buy and sell levels</h3><p>Buy areas step down from the current setup. Sell areas step up by one, two and three typical daily moves. They are decision markers, not guarantees.</p></div><div className="idea-level-grid"><div>{[0, 1, 2].map((index) => <IdeaLevelRow key={`buy-${index}`} side="buy" index={index} level={buyLevels[index] ?? null}/>)}</div><div>{[0, 1, 2].map((index) => <IdeaLevelRow key={`sell-${index}`} side="sell" index={index} level={sellLevels[index] ?? null}/>)}</div></div><p className="confidence-note"><strong>Probability from history is a past touch frequency.</strong> It checks whether the same percentage move was reached within the next 63 sessions across up to eleven past windows. A percentage appears once at least eight windows are available. It is not a prediction.</p></section>
        <SizingHelper idea={idea} buyLevels={buyLevels}/><footer className="idea-entry-foot"><span>Trade setup calculated {dateLabel(idea.asOfDate)}</span>{idea.sourceUrl ? <a href={idea.sourceUrl} target="_blank" rel="noreferrer">Market source</a> : null}{row ? <button type="button" onClick={() => onOpen(row)}>Open full analysis</button> : null}</footer>
      </div></details></article>;
    })}</div>}
    <section className="ideas-disclosure"><h2>A disciplined shortlist, not a promise</h2><p>These setups are candidates for trades, not proven winners or recommendations. The scan applies the same objective rules to every company, then gives you explicit levels and sizing arithmetic. Prices can move through every level.</p></section>
  </div>;
}

function WatchlistScreen({ items, alerts, loading, error, onRemove, onOpen, onUpdate, onRefresh }: { items: WatchItem[]; alerts: AlertItem[]; loading: boolean; error: string; onRemove: (symbol: string) => Promise<void>; onOpen: (row: PipelineRow) => void; onUpdate: (item: WatchItem, below: number | null, above: number | null) => Promise<void>; onRefresh: () => Promise<string> }) {
  const [busy, setBusy] = useState(""); const [message, setMessage] = useState(""); const [drafts, setDrafts] = useState<Record<string, { below: string; above: string }>>({});
  useEffect(() => { const next: Record<string, { below: string; above: string }> = {}; for (const item of items) next[item.symbol] = { below: item.targetBelow?.toString() ?? "", above: item.targetAbove?.toString() ?? "" }; setDrafts(next); }, [items]);
  async function save(item: WatchItem) { const draft = drafts[item.symbol] ?? { below: "", above: "" }; setBusy(item.symbol); setMessage(""); try { await onUpdate(item, numberOrNull(draft.below), numberOrNull(draft.above)); setMessage(`${item.symbol} targets saved.`); } catch { setMessage(`Could not save ${item.symbol} targets.`); } finally { setBusy(""); } }
  async function refresh() { setBusy("refresh"); try { setMessage(await onRefresh()); } catch { setMessage("Quotes could not be refreshed."); } finally { setBusy(""); } }
  return <div className="screen"><header className="page-intro small"><h1>Watchlist</h1><p>Save companies and choose a price that should trigger an alert. Alerts arrive in Muse chat.</p></header><DataBanner/><div className="watch-toolbar"><button className="secondary-button" onClick={() => void refresh()} disabled={busy === "refresh"}><Icon name="refresh"/>{busy === "refresh" ? "Checking…" : "Check prices"}</button><span>Shortlist prices are as of 25 Sep 2026. Tap Check prices for the latest quote.</span></div>{message ? <p className="action-message" role="status">{message}</p> : null}{loading ? <div className="status-panel">Loading watchlist…</div> : error ? <div className="status-panel error">{error}</div> : items.length === 0 ? <div className="empty-state"><h2>No stocks saved yet</h2><p>Open a company from the shortlist or Browse tab, then tap “Add to watchlist”. You set the alert price on the watch card.</p></div> : <section className="watch-list" aria-label="Saved stocks">{items.map((item) => { const row = rowByTicker.get(item.symbol); const draft = drafts[item.symbol] ?? { below: "", above: "" }; const itemAlerts = alerts.filter((alert) => alert.symbol === item.symbol).slice(0, 2); return <article className="watch-card" key={item.symbol}><button className="watch-open" onClick={() => { if (row) onOpen(row); }} disabled={!row}><span className="ticker-pill">{item.symbol}</span><span><b>{bundledCompanyName(item.symbol, item.name)}</b><small className="watch-price">{money(item.latestPrice)} · {feedStateLabel(item.feedState)}</small><small className="price-asof">as of {dateLabel(item.priceAsOf)}</small></span></button><div className="target-grid"><label><span>Alert me if the price falls below</span><input type="number" inputMode="decimal" step="any" value={draft.below} onChange={(event) => setDrafts((current) => ({ ...current, [item.symbol]: { ...draft, below: event.target.value } }))} placeholder="No target"/></label><label><span>Alert me if the price rises above</span><input type="number" inputMode="decimal" step="any" value={draft.above} onChange={(event) => setDrafts((current) => ({ ...current, [item.symbol]: { ...draft, above: event.target.value } }))} placeholder="No target"/></label></div><div className="watch-actions"><button onClick={() => void save(item)} disabled={busy === item.symbol}>{busy === item.symbol ? "Saving…" : "Save targets"}</button><button aria-label={`Remove ${item.symbol} from watchlist`} onClick={() => void onRemove(item.symbol)}><Icon name="trash"/>Remove</button></div>{item.lastError ? <p className="held-alert">The latest price could not be checked. Your alert is still saved.</p> : null}{itemAlerts.map((alert) => <p key={alert.id} className="triggered-alert">{alert.deliveredAt ? "Alert sent" : "Alert ready"}: {alertKindLabel(alert.kind)} {money(alert.threshold)}. Checked at {money(alert.price)}<small className="price-asof">as of {dateLabel(alert.triggeredAt)}</small></p>)}</article>; })}</section>}</div>;
}

function ScreenerScreen({ onOpen, initialTier }: { onOpen: (row: PipelineRow) => void; initialTier: Tier | null }) {
  const [query, setQuery] = useState(""); const [tiers, setTiers] = useState<Tier[]>(initialTier ? [initialTier] : []); const [minimumBq, setMinimumBq] = useState(0); const [cheapOnly, setCheapOnly] = useState(false); const [layer, setLayer] = useState<"all" | Layer>("all"); const [showDataGap, setShowDataGap] = useState(false); const [sort, setSort] = useState<"bq" | "cheapness">("bq"); const [limit, setLimit] = useState(80);
  useEffect(() => { if (initialTier) setTiers([initialTier]); }, [initialTier]);
  const filtered = useMemo(() => {
    const term = query.trim().toUpperCase();
    return universeRows.filter((row) => {
      if (term && !row.ticker.includes(term) && !displayName(row).toUpperCase().includes(term)) return false;
      if (!showDataGap && row.exclusion_code === "DATA_GAP") return false;
      if (tiers.length > 0 && (row.tier === null || !tiers.includes(row.tier))) return false;
      if (layer !== "all" && row.layer !== layer) return false;
      if (cheapOnly && !(percentBelow(row) !== null && (percentBelow(row) ?? 0) > 0)) return false;
      if (minimumBq > 0 && (row.bq_score === null || row.bq_score < minimumBq)) return false;
      return true;
    }).sort((a, b) => sort === "bq" ? (b.bq_score ?? -1) - (a.bq_score ?? -1) || a.ticker.localeCompare(b.ticker) : (percentBelow(b) ?? -999) - (percentBelow(a) ?? -999) || a.ticker.localeCompare(b.ticker));
  }, [query, tiers, minimumBq, cheapOnly, layer, showDataGap, sort]);
  useEffect(() => setLimit(80), [query, tiers, minimumBq, cheapOnly, layer, showDataGap, sort]);
  function toggleTier(tier: Tier) { setTiers((current) => current.includes(tier) ? current.filter((item) => item !== tier) : [...current, tier]); }
  return <div className="screen"><header className="page-intro small"><h1>Browse stocks</h1><p>Find companies by estimated value, business strength and how wide the estimate is.</p></header><DataBanner/><section className="filter-panel"><label className="search-input" htmlFor="screen-search"><Icon name="search"/><input id="screen-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by company or ticker" aria-label="Search by company or ticker"/></label><fieldset><legend>How wide is the fair-value estimate?</legend><div className="chip-row">{tierOptions.map((tier) => <button type="button" key={tier} className={`${tiers.includes(tier) ? "selected" : ""} ${confidenceClass(tierLabel(tier))}`} aria-pressed={tiers.includes(tier)} onClick={() => toggleTier(tier)}>{tierLabel(tier)}</button>)}</div></fieldset><div className="range-label"><label htmlFor="minimum-bq">Minimum business strength score</label><output>{minimumBq}</output></div><input id="minimum-bq" className="range-input" type="range" min="0" max="100" step="5" value={minimumBq} onChange={(event) => setMinimumBq(Number(event.target.value))}/><div className="select-grid"><label><span>Current price compared with fair value</span><select value={cheapOnly ? "below" : "all"} onChange={(event) => setCheapOnly(event.target.value === "below")}><option value="all">Show all companies with an estimate</option><option value="below">Only prices below our lowest estimate</option></select></label><label><span>Type of estimate</span><select value={layer} onChange={(event) => setLayer(event.target.value as "all" | Layer)}><option value="all">All estimate types</option><option value="A">Businesses with steady cash</option><option value="B">Businesses with unpredictable cash</option></select></label><label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as "bq" | "cheapness")}><option value="bq">Strongest businesses first</option><option value="cheapness">Biggest discount first</option></select></label></div><label className="toggle-row"><input type="checkbox" checked={showDataGap} onChange={(event) => setShowDataGap(event.target.checked)}/><span>Include companies with missing data</span></label></section><div className="result-count" aria-live="polite">{filtered.length} results</div><div className="universe-list">{filtered.slice(0, limit).map((row) => <UniverseRowButton key={row.ticker} row={row} onOpen={onOpen}/>)}</div>{limit < filtered.length ? <button className="secondary-button load-more" onClick={() => setLimit((value) => value + 80)}>Show more</button> : null}{filtered.length === 0 ? <div className="empty-state"><h2>No matches</h2><p>Clear a filter or lower the minimum business strength score.</p></div> : null}</div>;
}

function MoreScreen() {
  return <div className="screen"><header className="page-intro small"><h1>How the numbers work</h1><p>See how each number is calculated and where the prices came from.</p></header><DataBanner/><UniverseNote/>
    <section className="about-section honesty-box"><h2>What the main numbers mean</h2><p><strong>Fair value</strong> is our estimate of what one share may be worth based on the company’s cash flow. It is a range because the future is uncertain.</p><p><strong>Business strength</strong> is a score out of 100. A higher score means the company did better on checks such as cash, debt, growth and profitability.</p><p><strong>Past price ranges</strong> show places where the share price changed direction before. They do not predict what happens next.</p></section>
    <section className="about-section score-method" aria-labelledby="score-method-title"><h2 id="score-method-title">How the score works</h2>
      <section><h3>1. What the fair-value labels mean</h3><p>The label shows how confident we are in the fair-value estimate.</p><p>We estimate what the business’s cash flows are worth, then check how much the answer moves when we use cautious assumptions versus typical ones. If it barely moves, confidence is high. If it swings a lot, confidence is low.</p><dl className="tier-definitions"><div><dt className="confidence-high">High confidence</dt><dd>The narrowest quarter of ranges.</dd></div><div><dt className="confidence-moderate">Moderate confidence</dt><dd>The middle half of ranges.</dd></div><div><dt className="confidence-low">Low confidence</dt><dd>The widest quarter of ranges.</dd></div><div><dt className="confidence-low">Rough guide only</dt><dd>The numbers we start from are weak, so treat the range as a rough guide.</dd></div></dl></section>
      <section><h3>2. How the business-strength score works</h3><p>The score runs from 0 to 100. Higher means a stronger business. It is worked out from the company’s filed accounts, in five parts:</p><dl className="score-parts"><div><dt>Turning profit into cash</dt><dd><strong>25 points.</strong> Does reported profit arrive as real cash?</dd></div><div><dt>Returns the business generates</dt><dd><strong>25 points.</strong> How much profit it makes from the money tied up in it.</dd></div><div><dt>Steadiness of profit margins</dt><dd><strong>15 points.</strong> Do margins hold up year after year?</dd></div><div><dt>Debt load</dt><dd><strong>20 points.</strong> How much the business owes compared with what it owns.</dd></div><div><dt>Quality of reported profits</dt><dd><strong>15 points.</strong> Are the profits backed by cash, or by accounting entries?</dd></div></dl><p>We then adjust the total: up to 10 points for holding more cash than debt, up to 10 for a longer track record, and a deduction if the estimate range is very wide or the business looks unstable. Only the larger deduction ever applies. If the books fail basic integrity checks, for example cash flow that does not match reported profit, or restated accounts, we show no score at all. Banks get no score yet: we have no approved way to score them.</p></section>
      <section><h3>3. What counts as a good or bad score</h3><p>There is no pass or fail line. Among the large US companies we track, half score below 56 and half above. As a rough guide: 72 or above is the top quarter, strong; around 56 is the middle; 20 or below is the bottom quarter, weak. The shortlist puts the strongest businesses first, but only among companies priced below our lowest fair-value estimate.</p></section>
      <section><h3>4. How the shortlist is built</h3><ol><li>A company makes the shortlist only if its share price is below our lowest fair-value estimate.</li><li>The Invest tab starts with the strongest businesses first. You can switch to biggest discount to put the companies furthest below our lowest estimate first.</li></ol></section>
    </section>
    <section className="about-section"><h2>About this week’s data</h2><dl className="provenance-list"><div><dt>Current prices</dt><dd>Yahoo Finance, dated 25 Sep 2026</dd></div><div><dt>Companies checked</dt><dd>305 outside finance, plus 10 banks</dd></div><div><dt>Fair-value estimates</dt><dd>Still being tested</dd></div></dl></section>
    <section className="about-section honesty-box"><h2>About the company list</h2><p>{UNIVERSE_NOTE}</p><p>When the needed information is missing, the app says “Unable to price, data unavailable” instead of guessing.</p></section>
  </div>;
}

function resetPageScroll() {
  const root = document.documentElement;
  const body = document.body;
  const rootScrollBehavior = root.style.scrollBehavior;
  const bodyScrollBehavior = body.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  body.style.scrollBehavior = "auto";
  root.scrollTop = 0;
  body.scrollTop = 0;
  window.scrollTo(0, 0);
  root.scrollIntoView({ block: "start", inline: "nearest" });
  requestAnimationFrame(() => {
    root.style.scrollBehavior = rootScrollBehavior;
    body.style.scrollBehavior = bodyScrollBehavior;
  });
}

function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [{ id: "picker", label: "Invest" }, { id: "ideas", label: "Trade" }, { id: "watchlist", label: "Watchlist" }, { id: "screener", label: "Browse" }, { id: "more", label: "About" }];
  return <nav className="bottom-nav" aria-label="Primary navigation">{tabs.map((tab) => <button key={tab.id} className={active === tab.id ? "active" : ""} onClick={() => onChange(tab.id)} aria-current={active === tab.id ? "page" : undefined}><Icon name={tab.id}/><span>{tab.label}</span></button>)}</nav>;
}

export function App() {
  const [tab, setTab] = useState<Tab>("picker");
  const [activeRow, setActiveRow] = useState<PipelineRow | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [watchLoading, setWatchLoading] = useState(true);
  const [watchError, setWatchError] = useState("");
  const [screenerTier, setScreenerTier] = useState<Tier | null>(null);
  const [ideaRun, setIdeaRun] = useState<WeeklyIdeaRun>(null);
  const [weeklyIdeas, setWeeklyIdeas] = useState<WeeklyIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(true);
  const [ideasRefreshing, setIdeasRefreshing] = useState(false);
  const [ideasError, setIdeasError] = useState("");
  async function loadWorkspace() { setWatchLoading(true); setWatchError(""); try { const result = await api.listWorkspace({}); setWatchlist(result.watchlist); setAlerts(result.alerts); if (!result.ownerAccess) setWatchError("Private watchlist data and research notes are available only to the artifact owner."); } catch { setWatchError("The private workspace is temporarily unavailable. Your entered values have not been cleared."); } finally { setWatchLoading(false); } }
  async function loadWeeklyIdeas() { setIdeasLoading(true); setIdeasError(""); try { const result = await api.listWeeklyIdeas({}); setIdeaRun(result.run); setWeeklyIdeas(result.ideas); } catch { setIdeasError("The weekly scan could not be loaded. Please try again later."); } finally { setIdeasLoading(false); } }
  useEffect(() => { void loadWorkspace(); }, []);
  useEffect(() => { if (tab === "ideas") void refreshIdeas(); }, [tab]);
  useLayoutEffect(() => {
    resetPageScroll();
  }, [tab]);
  function openRow(row: PipelineRow) { setActiveRow(row); setDraftOpen(false); setTab("picker"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function openDraft() { setActiveRow(null); setDraftOpen(true); setTab("picker"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function closeDraft() { setDraftOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function changeTab(next: Tab) { setTab(next); setActiveRow(null); setDraftOpen(false); if (next !== "screener") setScreenerTier(null); resetPageScroll(); }
  async function addActive() { if (!activeRow) return; const result = await api.upsertWatchItem({ symbol: activeRow.ticker, name: displayName(activeRow), market: "US", currency: "USD", targetBelow: null, targetAbove: null, latestPrice: activeRow.price, priceAsOf: activeRow.price_date, sourceUrl: null, splitFactor: 1, dividendAdjustment: 0, adjustmentConfirmed: false }); setWatchlist((current) => [result.item, ...current.filter((item) => item.symbol !== result.item.symbol)]); }
  async function updateWatch(item: WatchItem, below: number | null, above: number | null) { const result = await api.upsertWatchItem({ symbol: item.symbol, name: bundledCompanyName(item.symbol, item.name), market: item.market, currency: item.currency, targetBelow: below, targetAbove: above, latestPrice: item.latestPrice, priceAsOf: item.priceAsOf, sourceUrl: item.sourceUrl, splitFactor: item.splitFactor, dividendAdjustment: item.dividendAdjustment, adjustmentConfirmed: item.adjustmentConfirmed === 1 }); setWatchlist((current) => current.map((entry) => entry.symbol === item.symbol ? result.item : entry)); }
  async function removeWatch(symbol: string) { await api.removeWatchItem({ symbol }); setWatchlist((current) => current.filter((item) => item.symbol !== symbol)); }
  async function refreshQuotes() { const result = await api.refreshWatchlistQuotes({ force: false }); await loadWorkspace(); if (result.skipped) return "Markets are closed. No quote refresh was needed."; return result.failures > 0 ? `${result.refreshed} prices updated. ${result.failures} could not be updated.` : `${result.refreshed} prices refreshed.`; }
  async function refreshIdeas() { setIdeasRefreshing(true); setIdeasError(""); try { const result = await api.refreshWeeklyIdeas({}); await loadWeeklyIdeas(); if (!result.ok) setIdeasError(result.message); } catch { setIdeasError("The scan could not finish. The previous weekly list is unchanged."); } finally { setIdeasRefreshing(false); } }
  function filterTier(tier: Tier) { setScreenerTier(tier); setActiveRow(null); setTab("screener"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  let content: ReactNode;
  if (draftOpen) content = <DraftShortlistScreen onBack={closeDraft}/>;
  else if (activeRow) content = <DetailScreen row={activeRow} watched={watchlist.some((item) => item.symbol === activeRow.ticker)} onBack={() => setActiveRow(null)} onAdd={addActive} onTierFilter={filterTier}/>;
  else if (tab === "ideas") content = <WeeklyIdeasScreen run={ideaRun} ideas={weeklyIdeas} loading={ideasLoading} error={ideasError} refreshing={ideasRefreshing} onRefresh={refreshIdeas} onOpen={openRow}/>;
  else if (tab === "watchlist") content = <WatchlistScreen items={watchlist} alerts={alerts} loading={watchLoading} error={watchError} onRemove={removeWatch} onOpen={openRow} onUpdate={updateWatch} onRefresh={refreshQuotes}/>;
  else if (tab === "screener") content = <ScreenerScreen onOpen={openRow} initialTier={screenerTier}/>;
  else if (tab === "more") content = <MoreScreen/>;
  else content = <PickerScreen onOpen={openRow} onOpenDraft={openDraft}/>;
  return <div className="app-shell"><SafeAreaTopScrim backgroundColor="#ffffff"/><main>{content}</main><BottomNav active={tab} onChange={changeTab}/></div>;
}
