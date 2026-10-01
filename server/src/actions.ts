import { defineAction, z, type ActionsModule, type Ctx } from "./standalone";
import { desc, eq, lt } from "drizzle-orm";
import * as schema from "./schema";

const marketSchema = z.enum(["US", "SGX"]);
const feedStateSchema = z.enum(["fresh", "stale", "down"]);
const entityTypeSchema = z.enum(["standard", "bank", "insurer", "reit"]);
const nullableNumber = z.number().finite().nullable();
const historyPointSchema = z.object({
  date: z.string(), close: z.number(), open: nullableNumber, high: nullableNumber, low: nullableNumber, volume: nullableNumber,
});
const sensitivityPointSchema = z.object({ discountRate: z.number(), terminalGrowth: z.number(), value: z.number() });
const quoteSchema = z.object({
  symbol: z.string(), providerSymbol: z.string().nullable(), name: z.string(), market: marketSchema,
  currency: z.string().nullable(), price: nullableNumber, change: nullableNumber, changePercent: nullableNumber,
  high: nullableNumber, low: nullableNumber, week52High: nullableNumber, week52Low: nullableNumber,
  marketCap: nullableNumber, marketStatus: z.string().nullable(), asOf: z.string().nullable(), sourceUrl: z.string().nullable(),
  providerHost: z.string().nullable(), feedState: feedStateSchema, adjustmentStatus: z.enum(["unverified", "manual"]),
  fetchedAt: z.string(), history: z.array(historyPointSchema), servedFromCache: z.boolean(),
});
const analysisInputSchema = z.object({
  symbol: z.string().min(1).max(20), name: z.string().min(1).max(160), market: marketSchema,
  currency: z.string().max(8).nullable(), entityType: entityTypeSchema, asOfDate: z.string().nullable(),
  periodLabel: z.string().min(1).max(40), shareBasis: z.enum(["basic", "diluted"]), accountingBasis: z.enum(["reported", "adjusted"]),
  sourceLabel: z.string().min(1).max(120), sourceUrl: z.string().max(1000).nullable(),
  priceAtAnalysis: nullableNumber, priceCurrency: z.string().max(8).nullable(), priceAsOf: z.string().nullable(),
  fcf: nullableNumber, growthRate: nullableNumber, terminalGrowth: nullableNumber, discountRate: nullableNumber,
  cash: nullableNumber, debt: nullableNumber, shares: nullableNumber, normalizedEps: nullableNumber, fairPe: nullableNumber,
  revenue: nullableNumber, fairPs: nullableNumber, revenueGrowth: nullableNumber, epsGrowth: nullableNumber, roic: nullableNumber,
  debtEquity: nullableNumber, fcfMargin: nullableNumber, interestCoverage: nullableNumber, shareChange: nullableNumber,
  marginTrend: nullableNumber, notes: z.string().max(4000),
});
const analysisSchema = analysisInputSchema.extend({
  id: z.number(), dcfValue: nullableNumber, earningsValue: nullableNumber, salesValue: nullableNumber, blendedValue: nullableNumber,
  coveragePercent: z.number(), valuationStatus: z.enum(["ready", "blocked", "insufficient"]), valuationMessage: z.string(),
  sensitivity: z.array(sensitivityPointSchema), qualityScore: nullableNumber, qualityComplete: z.number(), analysisVersion: z.number(),
  createdAt: z.string(), updatedAt: z.string(),
});
const watchItemSchema = z.object({
  id: z.number(), symbol: z.string(), name: z.string(), market: marketSchema, currency: z.string().nullable(),
  targetBelow: nullableNumber, targetAbove: nullableNumber, latestPrice: nullableNumber, priceAsOf: z.string().nullable(), sourceUrl: z.string().nullable(),
  alertZone: z.enum(["below", "above"]).nullable(), splitFactor: z.number(), dividendAdjustment: z.number(), adjustmentConfirmed: z.number(),
  feedState: feedStateSchema, lastCheckedAt: z.string().nullable(), lastSuccessAt: z.string().nullable(), lastError: z.string().nullable(),
  createdAt: z.string(), updatedAt: z.string(),
});
const alertSchema = z.object({
  id: z.number(), symbol: z.string(), kind: z.enum(["below", "above"]), threshold: z.number(), price: z.number(),
  deliveredAt: z.string().nullable(), triggeredAt: z.string(),
});
const versionSchema = z.object({ id: z.number(), symbol: z.string(), version: z.number(), createdAt: z.string(), valuationStatus: z.string(), coveragePercent: z.number(), sourceLabel: z.string(), sourceUrl: z.string().nullable(), currency: z.string().nullable(), periodLabel: z.string(), accountingBasis: z.string(), shareBasis: z.string() });
const auditSchema = z.object({ id: z.number(), symbol: z.string(), action: z.enum(["created", "updated", "deleted"]), details: z.string(), createdAt: z.string() });
const rubricSchema = z.object({ key: z.string(), label: z.string(), definition: z.string(), weight: z.number(), direction: z.enum(["higher", "lower"]), source: z.string() });
const formulaCheckSchema = z.object({ name: z.string(), expected: z.number(), actual: z.number(), passed: z.boolean() });
const healthSchema = z.object({ scheduleLabel: z.string(), deliveryChannel: z.string(), lastAttemptAt: z.string().nullable(), lastSuccessAt: z.string().nullable(), lastError: z.string().nullable(), lastRefreshed: z.number() });
const weeklyIdeaRunSchema = z.object({
  id: z.number(), weekKey: z.string(), asOfDate: z.string().nullable(), status: z.enum(["ready", "empty", "partial", "failed"]),
  universeCount: z.number(), quoteCount: z.number(), eligibleCount: z.number(), matchCount: z.number(), errorCount: z.number(),
  earningsCheckedAt: z.string().nullable(), earningsCheckedThrough: z.string().nullable(), earningsExcludedCount: z.number(),
  note: z.string().nullable(), scannedAt: z.string(),
});
const ideaPricePointSchema = z.object({ date: z.string(), close: z.number() });
const tradeSetupSchema = z.enum(["breakout", "trend_pullback", "momentum_leader"]);
const tradeLevelSchema = z.object({ label: z.string(), value: z.number(), cases: z.number(), hits: z.number().nullable(), rate: z.number().nullable() });
const tradeSetupDetailSchema = z.object({
  label: z.string(), explanation: z.string(), score: z.number(), threeMonthReturn: z.number(), distanceFromSma50: z.number(),
  sma50: z.number(), atr14: z.number(), change: z.number(), changePercent: z.number(), buyLevels: z.array(tradeLevelSchema), sellLevels: z.array(tradeLevelSchema),
});
const weeklyIdeaSchema = z.object({
  id: z.number(), runId: z.number(), weekKey: z.string(), rank: z.number(), symbol: z.string(), name: z.string(), close: z.number(), asOfDate: z.string(),
  prior52WeekHigh: z.number(), volumeMultiple: z.number(), medianDollarVolume: z.number(), realizedVolatility: z.number(), setup: tradeSetupSchema,
  setupDetail: tradeSetupDetailSchema.nullable(), history: z.array(ideaPricePointSchema), benchmark: z.array(ideaPricePointSchema), sourceUrl: z.string().nullable(), createdAt: z.string(),
});
const weeklyIdeaListSchema = z.object({ run: weeklyIdeaRunSchema.nullable(), ideas: z.array(weeklyIdeaSchema) });
const weeklyIdeaRefreshSchema = z.object({ ok: z.boolean(), status: z.enum(["ready", "empty", "partial", "failed"]), matchCount: z.number(), message: z.string(), scannedAt: z.string() });

const WEEKLY_IDEA_SYMBOLS = "A,AAPL,ABBV,ABT,ACN,ADBE,ADI,ADM,ADP,ADSK,AEE,AKAM,ALB,ALGN,ALLE,AMAT,AMCR,AMD,AME,AMGN,AMZN,ANET,APA,APD,APH,APTV,ATO,AVGO,AXON,AZO,BA,BAX,BBY,BDX,BF-B,BG,BKNG,BMY,BR,BSX,CAH,CARR,CAT,CBRE,CCL,CDNS,CDW,CF,CHD,CHRW,CHTR,CIEN,CL,CMCSA,CMG,CNC,COO,COR,COST,CPRT,CRH,CRL,CRM,CRWD,CSCO,CSGP,CTAS,CTSH,CVS,DASH,DDOG,DE,DECK,DELL,DG,DGX,DHR,DIS,DLTR,DOV,DPZ,DRI,DVA,DXCM,EBAY,ECHO,ECL,EFX,EIX,EL,ELV,EME,EOG,EQT,EVRG,EW,EXPD,EXPE,F,FANG,FAST,FCX,FDX,FFIV,FICO,FIX,FLEX,FOX,FOXA,FSLR,FTNT,FTV,GD,GEHC,GEN,GILD,GIS,GLW,GM,GNRC,GOOG,GOOGL,GPC,GRMN,GWW,HAS,HCA,HD,HII,HLT,HPE,HPQ,HRL,HSIC,HUBB,HUM,HWM,IDXX,IEX,IFF,ILMN,INCY,INTC,INTU,IQV,IR,ISRG,IT,ITW,J,JBHT,JBL,JNJ,KDP,KEYS,KHC,KLAC,KMB,KO,KR,KVUE,LDOS,LH,LHX,LII,LIN,LITE,LMT,LOW,LRCX,LULU,LUV,LVS,LYV,MAR,MAS,MCD,MCHP,MCK,MDLZ,MDT,META,MGM,MKC,MLM,MMM,MNST,MOS,MPC,MPWR,MRK,MRNA,MRVL,MSFT,MSI,MTD,MU,NCLH,NDSN,NFLX,NI,NOC,NOW,NRG,NTAP,NUE,NVDA,NXPI,ODFL,OMC,ON,ORCL,ORLY,OTIS,P,PANW,PAYX,PEP,PFE,PG,PH,PKG,PLTR,PNR,PNW,PODD,PPG,PPL,PTC,PWR,QCOM,RCL,REGN,RL,RMD,ROL,ROP,RSG,RTX,RVTY,SBUX,SJM,SMCI,SNA,SNPS,SO,STE,STLD,STX,SWKS,SYK,SYY,TDG,TDY,TECH,TEL,TER,TGT,TJX,TMO,TMUS,TPL,TPR,TRGP,TRMB,TSCO,TSLA,TSN,TT,TTWO,TXN,TYL,UAL,UBER,UHS,ULTA,UNH,UNP,UPS,URI,VEEV,VLTO,VMC,VRSK,VRSN,VRT,VRTX,VST,VTRS,WAB,WAT,WBD,WDAY,WDC,WM,WMB,WSM,WST,WYNN,XEL,XYL,YUM,ZBH,ZBRA,ZTS".split(",");

const ALLOWED_SOURCE_HOSTS = new Set(["finance.yahoo.com", "sg.finance.yahoo.com", "uk.finance.yahoo.com", "www.google.com", "www.nasdaq.com", "www.sgx.com"]);
const COVERAGE_THRESHOLD = 70;
const QUALITY_RUBRIC: z.infer<typeof rubricSchema>[] = [
  { key: "revenueGrowth", label: "Revenue CAGR", definition: "Multi-year annualised revenue growth.", weight: 12.5, direction: "higher", source: "Tagged company filings or research input" },
  { key: "epsGrowth", label: "EPS CAGR", definition: "Multi-year annualised earnings-per-share growth.", weight: 12.5, direction: "higher", source: "Tagged company filings or research input" },
  { key: "roic", label: "Return on invested capital", definition: "After-tax operating return relative to invested capital.", weight: 12.5, direction: "higher", source: "Tagged company filings or research input" },
  { key: "debtEquity", label: "Debt to equity", definition: "Total debt divided by shareholder equity.", weight: 12.5, direction: "lower", source: "Tagged company filings or research input" },
  { key: "fcfMargin", label: "Free-cash-flow margin", definition: "Free cash flow as a share of revenue.", weight: 12.5, direction: "higher", source: "Tagged company filings or research input" },
  { key: "interestCoverage", label: "Interest coverage", definition: "Operating earnings divided by interest expense.", weight: 12.5, direction: "higher", source: "Tagged company filings or research input" },
  { key: "shareChange", label: "Annual share-count change", definition: "Diluted shares growth; buybacks are negative.", weight: 12.5, direction: "lower", source: "Tagged company filings or research input" },
  { key: "marginTrend", label: "Operating-margin trend", definition: "Percentage-point change across the tagged period.", weight: 12.5, direction: "higher", source: "Tagged company filings or research input" },
];

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function normalizeInputSymbol(value: string): { symbol: string; market: "US" | "SGX" } | null {
  const clean = value.trim().toUpperCase().replace(/\s+/g, "");
  const sgx = clean.startsWith("SGX:") ? `${clean.slice(4)}.SI` : clean;
  if (/^[A-Z0-9]{1,8}\.SI$/.test(sgx)) return { symbol: sgx, market: "SGX" };
  const us = sgx.startsWith("NYSE:") || sgx.startsWith("NASDAQ:") ? sgx.split(":")[1] ?? "" : sgx;
  const provider = us.replace(".", "-");
  if (/^[A-Z][A-Z0-9-]{0,9}$/.test(provider)) return { symbol: provider, market: "US" };
  return null;
}
function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try { const parsed = new URL(value); return parsed.protocol === "https:" ? parsed.toString() : null; } catch { return null; }
}
function allowlistedSource(value: string | null | undefined): { url: string | null; host: string | null } {
  const safe = safeHttpsUrl(value);
  if (!safe) return { url: null, host: null };
  const host = new URL(safe).hostname.toLowerCase();
  return ALLOWED_SOURCE_HOSTS.has(host) ? { url: safe, host } : { url: null, host: null };
}
function dateOrNull(value: Date | null): string | null { return value ? value.toISOString() : null; }
function parseSensitivity(raw: string): z.infer<typeof sensitivityPointSchema>[] {
  try { const checked = z.array(sensitivityPointSchema).safeParse(JSON.parse(raw) as unknown); return checked.success ? checked.data : []; } catch { return []; }
}
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); const current = sorted[mid];
  if (current === undefined) return null; if (sorted.length % 2 === 1) return current;
  const previous = sorted[mid - 1]; return previous === undefined ? current : (previous + current) / 2;
}
function dcfPerShare(input: z.infer<typeof analysisInputSchema>, discountRate: number, terminalGrowth: number): number | null {
  if (input.fcf === null || input.growthRate === null || input.cash === null || input.debt === null || input.shares === null || input.shares <= 0) return null;
  const discount = discountRate / 100; const terminal = terminalGrowth / 100; const growth = input.growthRate / 100;
  if (discount <= 0 || terminal >= discount) return null;
  let futureFcf = input.fcf; let pv = 0;
  for (let year = 1; year <= 5; year += 1) { futureFcf *= 1 + growth; pv += futureFcf / Math.pow(1 + discount, year); }
  const terminalValue = (futureFcf * (1 + terminal)) / (discount - terminal);
  return finiteOrNull((pv + terminalValue / Math.pow(1 + discount, 5) + input.cash - input.debt) / input.shares);
}
function calculateValuation(input: z.infer<typeof analysisInputSchema>) {
  const numericFields = input.entityType === "standard"
    ? [input.fcf, input.growthRate, input.terminalGrowth, input.discountRate, input.cash, input.debt, input.shares, input.normalizedEps, input.fairPe, input.revenue, input.fairPs, input.priceAtAnalysis]
    : [input.shares, input.normalizedEps, input.fairPe, input.revenue, input.fairPs, input.priceAtAnalysis];
  const coveragePercent = Math.round((numericFields.filter((v) => v !== null).length / numericFields.length) * 100);
  const mixedCurrencies = input.currency !== null && input.priceCurrency !== null && input.currency.toUpperCase() !== input.priceCurrency.toUpperCase();
  const blocked: string[] = [];
  if (input.shares === null || input.shares <= 0) blocked.push("A positive share count is required.");
  if (input.priceAtAnalysis === null || input.priceAtAnalysis <= 0) blocked.push("A current market price is required.");
  if (mixedCurrencies) blocked.push(`Input currency ${input.currency ?? "unknown"} does not match price currency ${input.priceCurrency ?? "unknown"}.`);
  if (input.entityType !== "standard") blocked.push("This calculator does not yet support banks.");
  if (input.discountRate !== null && input.terminalGrowth !== null && input.terminalGrowth >= input.discountRate) blocked.push("Growth after year five must be lower than the yearly return you require.");
  if (!input.asOfDate) blocked.push("An input as-of date is required.");
  if (blocked.length > 0) return { dcfValue: null, earningsValue: null, salesValue: null, blendedValue: null, coveragePercent, valuationStatus: "blocked" as const, valuationMessage: blocked.join(" "), sensitivity: [] };
  const dcfValue = input.discountRate !== null && input.terminalGrowth !== null ? dcfPerShare(input, input.discountRate, input.terminalGrowth) : null;
  const earningsValue = input.normalizedEps !== null && input.fairPe !== null ? finiteOrNull(input.normalizedEps * input.fairPe) : null;
  const salesValue = input.revenue !== null && input.fairPs !== null && input.shares !== null && input.shares > 0 ? finiteOrNull((input.revenue / input.shares) * input.fairPs) : null;
  const sensitivity: z.infer<typeof sensitivityPointSchema>[] = [];
  if (input.discountRate !== null && input.terminalGrowth !== null) {
    for (const discountRate of [input.discountRate - 1, input.discountRate, input.discountRate + 1]) {
      for (const terminalGrowth of [input.terminalGrowth - 0.5, input.terminalGrowth, input.terminalGrowth + 0.5]) {
        const value = dcfPerShare(input, discountRate, terminalGrowth); if (value !== null) sensitivity.push({ discountRate, terminalGrowth, value });
      }
    }
  }
  const models = [dcfValue, earningsValue, salesValue].filter((v): v is number => v !== null);
  if (coveragePercent < COVERAGE_THRESHOLD || sensitivity.length < 9 || models.length < 2) {
    return { dcfValue, earningsValue, salesValue, blendedValue: null, coveragePercent, valuationStatus: "insufficient" as const, valuationMessage: `You entered ${coveragePercent}% of the needed information. Add enough information to calculate the stock’s value in at least two ways before an overall estimate appears.`, sensitivity };
  }
  return { dcfValue, earningsValue, salesValue, blendedValue: finiteOrNull(median(models)), coveragePercent, valuationStatus: "ready" as const, valuationMessage: "The overall estimate uses the assumptions you entered. It is not a price target or a recommendation.", sensitivity };
}
function scoreUp(value: number, thresholds: number[]): number { let score = 0; for (const threshold of thresholds) if (value >= threshold) score += 1; return Math.min(score, 5); }
function scoreDown(value: number, thresholds: number[]): number { let score = 0; for (const threshold of thresholds) if (value <= threshold) score += 1; return Math.min(score, 5); }
function calculateQuality(input: z.infer<typeof analysisInputSchema>) {
  const values = [input.revenueGrowth, input.epsGrowth, input.roic, input.debtEquity, input.fcfMargin, input.interestCoverage, input.shareChange, input.marginTrend];
  const complete = values.filter((v) => v !== null).length; if (complete < 8) return { qualityScore: null, qualityComplete: complete };
  const [revenueGrowth = 0, epsGrowth = 0, roic = 0, debtEquity = 0, fcfMargin = 0, interestCoverage = 0, shareChange = 0, marginTrend = 0] = values as number[];
  const total = scoreUp(revenueGrowth, [0, 5, 8, 12, 15]) + scoreUp(epsGrowth, [0, 5, 8, 12, 15]) + scoreUp(roic, [0, 3, 7, 10, 15]) + scoreDown(debtEquity, [2, 1.5, 1, 0.6, 0.3]) + scoreUp(fcfMargin, [0, 5, 10, 15, 20]) + scoreUp(interestCoverage, [1, 2, 4, 8, 15]) + scoreDown(shareChange, [5, 3, 1, -1, -3]) + scoreUp(marginTrend, [-1, 0, 0.5, 1.5, 3]);
  return { qualityScore: (total / 40) * 100, qualityComplete: complete };
}
function feedState(asOf: string | null, price: number | null, now: Date): "fresh" | "stale" | "down" {
  if (!asOf || price === null) return "down"; const time = new Date(asOf).getTime(); if (!Number.isFinite(time)) return "down";
  return now.getTime() - time <= 36 * 60 * 60 * 1000 ? "fresh" : "stale";
}
async function cachedQuote(ctx: Ctx, symbol: string, state: "stale" | "down") {
  const row = (await ctx.db<typeof schema>().select().from(schema.quoteCache).where(eq(schema.quoteCache.symbol, symbol)).limit(1))[0];
  return row ? mapCachedQuote({ ...row, feedState: state }) : null;
}
async function fetchQuote(ctx: Ctx, rawSymbol: string) {
  const parsed = normalizeInputSymbol(rawSymbol); if (!parsed) return null;
  const result = await ctx.tool.finance_ticker(parsed.symbol, { interval: "1d" });
  const instrument = result.content.instrument;
  if (!instrument || result.content.resolved.matched !== "exact") return null;
  const providerSymbol = (instrument.symbol ?? result.content.resolved.symbol).toUpperCase();
  const providerParsed = normalizeInputSymbol(providerSymbol); if (!providerParsed || providerParsed.market !== parsed.market) return null;
  const source = allowlistedSource(instrument.url ?? result.content.sources[0]?.url ?? null);
  const history = (instrument.history?.points ?? []).flatMap((point) => point.date !== null && point.close !== null ? [{ date: point.date, close: point.close, open: finiteOrNull(point.open), high: finiteOrNull(point.high), low: finiteOrNull(point.low), volume: finiteOrNull(point.volume) }] : []);
  const now = new Date(); const price = finiteOrNull(instrument.price); const asOf = instrument.as_of ?? null;
  const quote = { symbol: parsed.symbol, providerSymbol, name: instrument.name, market: parsed.market, currency: instrument.currency ?? null, price, change: finiteOrNull(instrument.change), changePercent: finiteOrNull(instrument.change_percent), high: finiteOrNull(instrument.high), low: finiteOrNull(instrument.low), week52High: finiteOrNull(instrument.week_52_high), week52Low: finiteOrNull(instrument.week_52_low), marketCap: finiteOrNull(instrument.market_cap), marketStatus: instrument.market_status ?? null, asOf, sourceUrl: source.url, providerHost: source.host, feedState: feedState(asOf, price, now), adjustmentStatus: "unverified" as const, fetchedAt: now.toISOString(), history, servedFromCache: false };
  const db = ctx.db<typeof schema>();
  await db.insert(schema.quoteCache).values({ ...quote, historyJson: JSON.stringify(history), fetchedAt: now, updatedAt: now }).onConflictDoUpdate({ target: schema.quoteCache.symbol, set: { providerSymbol, name: quote.name, market: quote.market, currency: quote.currency, price, change: quote.change, changePercent: quote.changePercent, high: quote.high, low: quote.low, week52High: quote.week52High, week52Low: quote.week52Low, marketCap: quote.marketCap, marketStatus: quote.marketStatus, asOf, sourceUrl: source.url, providerHost: source.host, feedState: quote.feedState, adjustmentStatus: quote.adjustmentStatus, historyJson: JSON.stringify(history), fetchedAt: now, updatedAt: now } });
  return quote;
}
function mapAnalysis(row: typeof schema.analyses.$inferSelect): z.infer<typeof analysisSchema> { return { ...row, sensitivity: parseSensitivity(row.sensitivityJson), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }; }
function mapWatch(row: typeof schema.watchlist.$inferSelect): z.infer<typeof watchItemSchema> { return { ...row, lastCheckedAt: dateOrNull(row.lastCheckedAt), lastSuccessAt: dateOrNull(row.lastSuccessAt), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }; }
function mapCachedQuote(row: typeof schema.quoteCache.$inferSelect): z.infer<typeof quoteSchema> {
  let history: z.infer<typeof historyPointSchema>[] = []; try { const checked = z.array(historyPointSchema).safeParse(JSON.parse(row.historyJson) as unknown); if (checked.success) history = checked.data; } catch { history = []; }
  return { symbol: row.symbol, providerSymbol: row.providerSymbol, name: row.name, market: row.market, currency: row.currency, price: row.price, change: row.change, changePercent: row.changePercent, high: row.high, low: row.low, week52High: row.week52High, week52Low: row.week52Low, marketCap: row.marketCap, marketStatus: row.marketStatus, asOf: row.asOf, sourceUrl: row.sourceUrl, providerHost: row.providerHost, feedState: row.feedState, adjustmentStatus: row.adjustmentStatus, fetchedAt: row.fetchedAt.toISOString(), history, servedFromCache: true };
}
function mapVersion(row: typeof schema.analysisVersions.$inferSelect): z.infer<typeof versionSchema> {
  let valuationStatus = "unknown"; let coveragePercent = 0; let sourceLabel = "Source unavailable"; let sourceUrl: string | null = null; let currency: string | null = null; let periodLabel = "Period unavailable"; let accountingBasis = "Adjustment unavailable"; let shareBasis = "Share basis unavailable";
  try {
    const raw: unknown = JSON.parse(row.snapshotJson);
    if (raw && typeof raw === "object") {
      const snapshot = raw as Record<string, unknown>;
      if (typeof snapshot.valuationStatus === "string") valuationStatus = snapshot.valuationStatus;
      if (typeof snapshot.coveragePercent === "number") coveragePercent = snapshot.coveragePercent;
      if (typeof snapshot.sourceLabel === "string") sourceLabel = snapshot.sourceLabel;
      if (typeof snapshot.sourceUrl === "string") sourceUrl = safeHttpsUrl(snapshot.sourceUrl);
      if (typeof snapshot.currency === "string") currency = snapshot.currency;
      if (typeof snapshot.periodLabel === "string") periodLabel = snapshot.periodLabel;
      if (typeof snapshot.accountingBasis === "string") accountingBasis = snapshot.accountingBasis;
      if (typeof snapshot.shareBasis === "string") shareBasis = snapshot.shareBasis;
    }
  } catch { /* Preserve explicit unavailable labels for legacy snapshots. */ }
  return { id: row.id, symbol: row.symbol, version: row.version, createdAt: row.createdAt.toISOString(), valuationStatus, coveragePercent, sourceLabel, sourceUrl, currency, periodLabel, accountingBasis, shareBasis };
}
function localDate(now: Date, market: "US" | "SGX"): string { return new Intl.DateTimeFormat("en-CA", { timeZone: market === "SGX" ? "Asia/Singapore" : "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
function venueOpen(now: Date, market: "US" | "SGX"): boolean {
  const timeZone = market === "SGX" ? "Asia/Singapore" : "America/New_York";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ""; const weekday = get("weekday"); if (weekday === "Sat" || weekday === "Sun") return false;
  const minutes = Number(get("hour")) * 60 + Number(get("minute")); return market === "SGX" ? minutes >= 540 && minutes < 1020 : minutes >= 570 && minutes < 960;
}
function providerSaysClosed(status: string | null): boolean { return status !== null && /(closed|holiday|post|pre)/i.test(status); }
function formulaChecks(): z.infer<typeof formulaCheckSchema>[] {
  const earnings = 2 * 15; const sales = (100 / 10) * 2; const gordon = (100 * 1.02) / (0.10 - 0.02);
  return [
    { name: "EPS 2 × P/E 15", expected: 30, actual: earnings, passed: earnings === 30 },
    { name: "Revenue 100 ÷ 10 shares × P/S 2", expected: 20, actual: sales, passed: sales === 20 },
    { name: "Gordon value: 100 FCF, 2% growth, 10% discount", expected: 1275, actual: gordon, passed: Math.abs(gordon - 1275) < 0.0001 },
  ];
}

type IdeaBar = { date: string; close: number; high: number; low: number; volume: number };
type IdeaPricePoint = z.infer<typeof ideaPricePointSchema>;
type TradeLevel = z.infer<typeof tradeLevelSchema>;
type TradeSetup = z.infer<typeof tradeSetupSchema>;
type RawIdeaCandidate = {
  symbol: string; name: string; close: number; asOfDate: string; history: IdeaPricePoint[]; sourceUrl: string | null;
  bars: IdeaBar[]; prior52WeekHigh: number; volumeMultiple: number; medianDollarVolume: number; realizedVolatility: number;
  sma50: number; sma50Prior: number; ema20: number; atr14: number; threeMonthReturn: number; distanceFromSma50: number;
  isBreakout: boolean; isPullback: boolean; change: number; changePercent: number;
};
type IdeaScanOutcome = { quoteReceived: boolean; eligible: boolean; asOfDate: string | null; candidate: RawIdeaCandidate | null };
type EarningsWindow = { symbols: Set<string>; checkedAt: Date; checkedThrough: string };

const nasdaqEarningsResponseSchema = z.object({
  data: z.object({
    rows: z.array(z.object({ symbol: z.string().nullable().optional() }).passthrough()).nullable().optional(),
  }).nullable(),
}).passthrough();

function addCalendarDays(value: string, days: number): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
async function fetchUpcomingEarningsWindow(now: Date): Promise<EarningsWindow | null> {
  const start = localDate(now, "US");
  const dates = Array.from({ length: 8 }, (_, index) => addCalendarDays(start, index));
  try {
    const results = await Promise.all(dates.map(async (date) => {
      const response = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${date}`, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      });
      if (!response.ok) throw new Error("Earnings calendar unavailable.");
      const parsed = nasdaqEarningsResponseSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.data === null) throw new Error("Earnings calendar response was incomplete.");
      return parsed.data.data.rows ?? [];
    }));
    const symbols = new Set(results.flat().flatMap((row) => {
      const symbol = row.symbol?.trim().toUpperCase();
      return symbol ? [symbol.replace(".", "-")] : [];
    }));
    return { symbols, checkedAt: now, checkedThrough: dates.at(-1) ?? start };
  } catch {
    return null;
  }
}

function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (values.length - 1);
  return Number.isFinite(variance) ? Math.sqrt(variance) : null;
}
function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const value = values.reduce((sum, item) => sum + item, 0) / values.length;
  return Number.isFinite(value) ? value : null;
}
function ema(values: number[], period: number): number | null {
  const first = values[0];
  if (values.length < period || first === undefined) return null;
  const multiplier = 2 / (period + 1); let current = first;
  for (const value of values.slice(1)) current = value * multiplier + current * (1 - multiplier);
  return Number.isFinite(current) ? current : null;
}
function marketWeekKey(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const daysFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return date.toISOString().slice(0, 10);
}
function eligibilityMetrics(bars: IdeaBar[], index: number): { medianDollarVolume: number; realizedVolatility: number } | null {
  if (index < 70 || index >= bars.length) return null;
  const current = bars[index];
  if (!current || current.close < 5) return null;
  const recentBars = bars.slice(index - 19, index + 1);
  const returnBars = bars.slice(index - 20, index + 1);
  if (recentBars.length !== 20 || returnBars.length !== 21) return null;
  const medianDollarVolume = median(recentBars.map((bar) => bar.close * bar.volume));
  if (medianDollarVolume === null || medianDollarVolume < 20_000_000) return null;
  const returns: number[] = [];
  for (let offset = 1; offset < returnBars.length; offset += 1) {
    const previous = returnBars[offset - 1]; const next = returnBars[offset];
    if (!previous || !next || previous.close <= 0 || next.close <= 0) return null;
    returns.push(Math.log(next.close / previous.close));
  }
  const deviation = standardDeviation(returns);
  if (deviation === null) return null;
  const realizedVolatility = deviation * Math.sqrt(252);
  if (realizedVolatility < 0.15 || realizedVolatility > 0.80) return null;
  return { medianDollarVolume, realizedVolatility };
}
function percentile(values: number[], quantile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1));
  return sorted[index] ?? null;
}
function historicalTouch(bars: IdeaBar[], offset: number, side: "buy" | "sell"): { cases: number; hits: number | null; rate: number | null } {
  const samples: boolean[] = [];
  const finalAnchor = bars.length - 64;
  for (let index = Math.max(50, finalAnchor - 21 * 10); index <= finalAnchor; index += 21) {
    const anchor = bars[index]; if (!anchor) continue;
    const target = anchor.close * (1 + offset); const forward = bars.slice(index + 1, index + 64);
    if (forward.length < 40) continue;
    samples.push(side === "buy" ? forward.some((bar) => bar.low <= target) : forward.some((bar) => bar.high >= target));
  }
  if (samples.length < 8) return { cases: samples.length, hits: null, rate: null };
  const hits = samples.filter(Boolean).length;
  return { cases: samples.length, hits, rate: Math.round((hits / samples.length) * 100) };
}
function buildTradeLevels(candidate: RawIdeaCandidate, setup: TradeSetup): { buyLevels: TradeLevel[]; sellLevels: TradeLevel[] } {
  const { close, atr14, sma50, ema20, prior52WeekHigh, bars } = candidate;
  const rawBuys = setup === "breakout" ? [prior52WeekHigh, prior52WeekHigh - atr14, sma50]
    : setup === "trend_pullback" ? [sma50, sma50 - atr14 * .75, sma50 - atr14 * 1.5]
      : [close - atr14 * .5, ema20, sma50];
  const buyValues = [...rawBuys].map((value) => Math.max(.01, value)).sort((a, b) => b - a);
  const sellValues = [close + atr14, close + atr14 * 2, close + atr14 * 3];
  const make = (value: number, index: number, side: "buy" | "sell"): TradeLevel => {
    const rounded = Math.round(value * 100) / 100; const touch = historicalTouch(bars, rounded / close - 1, side);
    return { label: `${side === "buy" ? "Buy" : "Sell"} ${index + 1}`, value: rounded, ...touch };
  };
  return { buyLevels: buyValues.map((value, index) => make(value, index, "buy")), sellLevels: sellValues.map((value, index) => make(value, index, "sell")) };
}
async function evaluateWeeklyIdea(ctx: Ctx, symbol: string): Promise<IdeaScanOutcome> {
  try {
    const since = new Date(); since.setUTCFullYear(since.getUTCFullYear() - 5);
    const result = await ctx.tool.finance_ticker(symbol, { interval: "1d", since: since.toISOString().slice(0, 10) });
    const instrument = result.content.instrument;
    if (!instrument || result.content.resolved.matched !== "exact") return { quoteReceived: false, eligible: false, asOfDate: null, candidate: null };
    const now = new Date();
    const allBars: IdeaBar[] = (instrument.history?.points ?? []).flatMap((point) => {
      const close = point.close; const high = point.high; const low = point.low; const volume = point.volume;
      if (!point.date || typeof close !== "number" || typeof high !== "number" || typeof low !== "number" || typeof volume !== "number") return [];
      if (![close, high, low, volume].every((value) => Number.isFinite(value)) || close <= 0 || high <= 0 || low <= 0 || volume <= 0) return [];
      return [{ date: point.date.slice(0, 10), close, high, low, volume }];
    });
    const today = localDate(now, "US");
    const bars = venueOpen(now, "US") ? allBars.filter((bar) => bar.date < today) : allBars;
    const index = bars.length - 1; const current = bars[index]; const previous = bars[index - 1]; const asOfDate = current?.date ?? instrument.as_of?.slice(0, 10) ?? null;
    if (!current || !previous || index < 70 || !asOfDate) return { quoteReceived: true, eligible: false, asOfDate, candidate: null };
    const eligibility = eligibilityMetrics(bars, index);
    if (!eligibility) return { quoteReceived: true, eligible: false, asOfDate, candidate: null };
    const closes = bars.map((bar) => bar.close); const sma50 = average(closes.slice(index - 49, index + 1)); const sma50Prior = average(closes.slice(index - 69, index - 19)); const ema20Value = ema(closes.slice(Math.max(0, index - 99), index + 1), 20);
    const threeMonthBase = bars[index - 63];
    const tr = bars.slice(index - 13, index + 1).map((bar, offset) => { const absoluteIndex = index - 13 + offset; const prior = bars[absoluteIndex - 1]; return prior ? Math.max(bar.high - bar.low, Math.abs(bar.high - prior.close), Math.abs(bar.low - prior.close)) : bar.high - bar.low; });
    const atr14 = average(tr);
    if (sma50 === null || sma50Prior === null || ema20Value === null || atr14 === null || !threeMonthBase || sma50 <= 0 || threeMonthBase.close <= 0) return { quoteReceived: true, eligible: true, asOfDate, candidate: null };
    const prior20 = bars.slice(index - 20, index); const prior252 = bars.slice(Math.max(0, index - 252), index);
    if (prior20.length < 20 || prior252.length < 200) return { quoteReceived: true, eligible: true, asOfDate, candidate: null };
    const priorMedianDollarVolume = median(prior20.map((bar) => bar.close * bar.volume));
    if (priorMedianDollarVolume === null || priorMedianDollarVolume <= 0) return { quoteReceived: true, eligible: true, asOfDate, candidate: null };
    const prior20High = Math.max(...prior20.map((bar) => bar.high)); const prior52WeekHigh = Math.max(...prior252.map((bar) => bar.high));
    const volumeMultiple = (current.close * current.volume) / priorMedianDollarVolume;
    const isBreakout = volumeMultiple >= 1.25 && current.close > prior20High && current.close > prior52WeekHigh;
    const distanceFromSma50 = ((current.close - sma50) / sma50) * 100; const threeMonthReturn = ((current.close / threeMonthBase.close) - 1) * 100;
    const recentTouch = bars.slice(index - 4, index + 1).some((bar) => bar.low <= sma50 * 1.01);
    const isPullback = sma50 > sma50Prior && current.close >= sma50 && distanceFromSma50 <= 5 && threeMonthReturn > 0 && recentTouch;
    const sourceUrl = allowlistedSource(instrument.url ?? result.content.sources[0]?.url ?? null).url;
    return { quoteReceived: true, eligible: true, asOfDate, candidate: { symbol, name: instrument.name || symbol, close: current.close, asOfDate, history: bars.slice(-1260).map((bar) => ({ date: bar.date, close: bar.close })), sourceUrl, bars, prior52WeekHigh, volumeMultiple, medianDollarVolume: eligibility.medianDollarVolume, realizedVolatility: eligibility.realizedVolatility, sma50, sma50Prior, ema20: ema20Value, atr14, threeMonthReturn, distanceFromSma50, isBreakout, isPullback, change: current.close - previous.close, changePercent: ((current.close / previous.close) - 1) * 100 } };
  } catch {
    return { quoteReceived: false, eligible: false, asOfDate: null, candidate: null };
  }
}
async function fetchBenchmarkHistory(ctx: Ctx): Promise<IdeaPricePoint[]> {
  try {
    const since = new Date(); since.setUTCFullYear(since.getUTCFullYear() - 5);
    const result = await ctx.tool.finance_ticker("SPY", { interval: "1d", since: since.toISOString().slice(0, 10) });
    const instrument = result.content.instrument;
    if (!instrument || result.content.resolved.matched !== "exact") return [];
    return (instrument.history?.points ?? []).flatMap((point) => point.date && typeof point.close === "number" && Number.isFinite(point.close) && point.close > 0 ? [{ date: point.date.slice(0, 10), close: point.close }] : []).slice(-1260);
  } catch { return []; }
}
function mapWeeklyIdeaRun(row: typeof schema.weeklyIdeaRuns.$inferSelect): z.infer<typeof weeklyIdeaRunSchema> {
  return { ...row, earningsCheckedAt: dateOrNull(row.earningsCheckedAt), scannedAt: row.scannedAt.toISOString() };
}
function mapWeeklyIdea(row: typeof schema.weeklyIdeas.$inferSelect): z.infer<typeof weeklyIdeaSchema> {
  let history: IdeaPricePoint[] = []; let benchmark: IdeaPricePoint[] = []; let setupDetail: z.infer<typeof tradeSetupDetailSchema> | null = null;
  try { const parsed = z.array(ideaPricePointSchema).safeParse(JSON.parse(row.historyJson ?? "[]") as unknown); if (parsed.success) history = parsed.data; } catch { history = []; }
  try { const parsed = z.array(ideaPricePointSchema).safeParse(JSON.parse(row.benchmarkJson ?? "[]") as unknown); if (parsed.success) benchmark = parsed.data; } catch { benchmark = []; }
  try { const parsed = tradeSetupDetailSchema.safeParse(JSON.parse(row.setupJson) as unknown); if (parsed.success) setupDetail = parsed.data; } catch { setupDetail = null; }
  return { ...row, setupDetail, history, benchmark, createdAt: row.createdAt.toISOString() };
}
function requireOwner(ctx: Ctx): void {
  if (!ctx.viewer?.isOwner) throw new Error("This feature is available only to the artifact owner.");
}
async function loadLatestWeeklyIdeas(ctx: Ctx): Promise<z.infer<typeof weeklyIdeaListSchema>> {
  const db = ctx.db<typeof schema>();
  const run = (await db.select().from(schema.weeklyIdeaRuns).orderBy(desc(schema.weeklyIdeaRuns.scannedAt)).limit(1))[0];
  if (!run) return { run: null, ideas: [] };
  const ideas = await db.select().from(schema.weeklyIdeas).where(eq(schema.weeklyIdeas.runId, run.id)).orderBy(schema.weeklyIdeas.rank);
  return { run: mapWeeklyIdeaRun(run), ideas: ideas.map(mapWeeklyIdea) };
}

export const Actions = {
  listWeeklyIdeas: defineAction({
    request: z.object({}), response: weeklyIdeaListSchema,
    async handler(ctx): Promise<z.infer<typeof weeklyIdeaListSchema>> { return loadLatestWeeklyIdeas(ctx); },
  }),
  refreshWeeklyIdeas: defineAction({
    request: z.object({}), response: weeklyIdeaRefreshSchema,
    async handler(ctx): Promise<z.infer<typeof weeklyIdeaRefreshSchema>> {
      const scannedAt = new Date();
      const latestRun = (await ctx.db<typeof schema>().select().from(schema.weeklyIdeaRuns).orderBy(desc(schema.weeklyIdeaRuns.scannedAt)).limit(1))[0];
      const requiredEarningsThrough = addCalendarDays(localDate(scannedAt, "US"), 7);
      if (latestRun && latestRun.earningsCheckedThrough !== null && latestRun.earningsCheckedThrough >= requiredEarningsThrough && scannedAt.getTime() - latestRun.scannedAt.getTime() < 6 * 60 * 60 * 1000) {
        return { ok: true, status: latestRun.status, matchCount: latestRun.matchCount, message: "The latest market and earnings scan is already up to date.", scannedAt: latestRun.scannedAt.toISOString() };
      }
      const outcomes: IdeaScanOutcome[] = [];
      for (let start = 0; start < WEEKLY_IDEA_SYMBOLS.length; start += 24) {
        const batch = WEEKLY_IDEA_SYMBOLS.slice(start, start + 24);
        outcomes.push(...await Promise.all(batch.map((symbol) => evaluateWeeklyIdea(ctx, symbol))));
      }
      const quoteCount = outcomes.filter((outcome) => outcome.quoteReceived).length;
      const eligibleCount = outcomes.filter((outcome) => outcome.eligible).length;
      const errorCount = WEEKLY_IDEA_SYMBOLS.length - quoteCount;
      const asOfDates = outcomes.flatMap((outcome) => outcome.asOfDate ? [outcome.asOfDate] : []);
      const asOfDate = asOfDates.sort().at(-1) ?? null;
      const rawCandidates = outcomes.flatMap((outcome) => outcome.candidate ? [outcome.candidate] : []);
      if (quoteCount < 40 || !asOfDate || rawCandidates.length < 40) {
        return { ok: false, status: "failed", matchCount: 0, message: "The market-data scan did not return enough complete histories. The previous weekly list was kept.", scannedAt: scannedAt.toISOString() };
      }
      const momentumCutoff = percentile(rawCandidates.map((candidate) => candidate.threeMonthReturn), .8);
      if (momentumCutoff === null) return { ok: false, status: "failed", matchCount: 0, message: "The momentum ranking could not be calculated. The previous weekly list was kept.", scannedAt: scannedAt.toISOString() };
      const classified = rawCandidates.flatMap((candidate) => {
        let setup: TradeSetup | null = null;
        if (candidate.isBreakout) setup = "breakout";
        else if (candidate.isPullback) setup = "trend_pullback";
        else if (candidate.threeMonthReturn >= momentumCutoff && candidate.sma50 > candidate.sma50Prior && candidate.distanceFromSma50 >= 0 && candidate.distanceFromSma50 <= 10) setup = "momentum_leader";
        if (!setup) return [];
        const label = setup === "breakout" ? "Breakout" : setup === "trend_pullback" ? "Trend pullback" : "Momentum leader";
        const explanation = setup === "breakout"
          ? "A fresh 52-week high closed on unusually heavy trading."
          : setup === "trend_pullback"
            ? "A strong stock dipped to its rising 50-day average and held."
            : "One of the market’s strongest three-month performers, still within 10% of its rising 50-day average.";
        const score = candidate.threeMonthReturn - Math.max(0, candidate.distanceFromSma50 - 5) * 2 + (setup === "breakout" ? 5 : setup === "trend_pullback" ? 3 : 0);
        const tradeLevels = buildTradeLevels(candidate, setup);
        return [{ candidate, setup, setupDetail: { label, explanation, score, threeMonthReturn: candidate.threeMonthReturn, distanceFromSma50: candidate.distanceFromSma50, sma50: candidate.sma50, atr14: candidate.atr14, change: candidate.change, changePercent: candidate.changePercent, ...tradeLevels } }];
      }).sort((a, b) => b.setupDetail.score - a.setupDetail.score || a.candidate.symbol.localeCompare(b.candidate.symbol));
      const earningsWindow = await fetchUpcomingEarningsWindow(scannedAt);
      if (!earningsWindow) {
        return { ok: false, status: "failed", matchCount: 0, message: "The next seven days of earnings could not be verified. The previous weekly list was kept.", scannedAt: scannedAt.toISOString() };
      }
      const earningsExcludedCount = classified.filter((item) => earningsWindow.symbols.has(item.candidate.symbol)).length;
      const earningsCleared = classified.filter((item) => !earningsWindow.symbols.has(item.candidate.symbol));
      const selected = earningsCleared.slice(0, 5); const benchmark = await fetchBenchmarkHistory(ctx);
      const weekKey = marketWeekKey(asOfDate); const db = ctx.db<typeof schema>();
      const existing = (await db.select().from(schema.weeklyIdeaRuns).where(eq(schema.weeklyIdeaRuns.weekKey, weekKey)).limit(1))[0];
      const status: "ready" | "empty" | "partial" | "failed" = errorCount > 0 ? "partial" : selected.length > 0 ? "ready" : "empty";
      const note = selected.length === 0
        ? earningsExcludedCount > 0
          ? `${earningsExcludedCount} technical ${earningsExcludedCount === 1 ? "match was" : "matches were"} held back because earnings fall within seven days. No filler ideas were added.`
          : "No company matched the three objective setups this week. No filler ideas were added."
        : errorCount > 0
          ? `${errorCount} companies could not be checked; the qualifying results shown are complete.`
          : earningsExcludedCount > 0
            ? `${earningsExcludedCount} otherwise qualifying ${earningsExcludedCount === 1 ? "stock was" : "stocks were"} held back because earnings fall within seven days.`
            : null;
      let runId: number;
      if (existing) {
        runId = existing.id;
        await db.delete(schema.weeklyIdeas).where(eq(schema.weeklyIdeas.runId, runId));
        await db.update(schema.weeklyIdeaRuns).set({ asOfDate, status, universeCount: WEEKLY_IDEA_SYMBOLS.length, quoteCount, eligibleCount, matchCount: earningsCleared.length, errorCount, earningsCheckedAt: earningsWindow.checkedAt, earningsCheckedThrough: earningsWindow.checkedThrough, earningsExcludedCount, note, scannedAt }).where(eq(schema.weeklyIdeaRuns.id, runId));
      } else {
        await db.insert(schema.weeklyIdeaRuns).values({ weekKey, asOfDate, status, universeCount: WEEKLY_IDEA_SYMBOLS.length, quoteCount, eligibleCount, matchCount: earningsCleared.length, errorCount, earningsCheckedAt: earningsWindow.checkedAt, earningsCheckedThrough: earningsWindow.checkedThrough, earningsExcludedCount, note, scannedAt });
        const inserted = (await db.select().from(schema.weeklyIdeaRuns).where(eq(schema.weeklyIdeaRuns.weekKey, weekKey)).limit(1))[0];
        if (!inserted) return { ok: false, status: "failed", matchCount: 0, message: "The scan finished, but the weekly list could not be saved.", scannedAt: scannedAt.toISOString() };
        runId = inserted.id;
      }
      for (let index = 0; index < selected.length; index += 1) {
        const item = selected[index]; if (!item) continue; const idea = item.candidate;
        await db.insert(schema.weeklyIdeas).values({ runId, weekKey, rank: index + 1, symbol: idea.symbol, name: idea.name, close: idea.close, asOfDate, prior52WeekHigh: idea.prior52WeekHigh, volumeMultiple: idea.volumeMultiple, medianDollarVolume: idea.medianDollarVolume, realizedVolatility: idea.realizedVolatility, setup: item.setup, setupJson: JSON.stringify(item.setupDetail), historyJson: JSON.stringify(idea.history), benchmarkJson: JSON.stringify(benchmark), sourceUrl: idea.sourceUrl, createdAt: scannedAt });
      }
      ctx.invalidateQueries();
      const message = selected.length === 0
        ? earningsExcludedCount > 0
          ? `Scan complete. ${earningsExcludedCount} technical ${earningsExcludedCount === 1 ? "match was" : "matches were"} held back for earnings, leaving no eligible trade ideas.`
          : "Scan complete. No companies matched the three objective setups this week."
        : `${selected.length} trade ideas saved from ${earningsCleared.length} earnings-cleared setups${earningsExcludedCount > 0 ? `; ${earningsExcludedCount} held back for earnings` : ""}.`;
      return { ok: true, status, matchCount: selected.length, message, scannedAt: scannedAt.toISOString() };
    },
  }),
  lookupTicker: defineAction({
    request: z.object({ symbol: z.string().min(1).max(30) }), response: z.object({ ok: z.boolean(), message: z.string().nullable(), quote: quoteSchema.nullable() }),
    async handler(ctx, args) {
      requireOwner(ctx);
      const parsed = normalizeInputSymbol(args.symbol); if (!parsed) return { ok: false, message: "Use a US ticker such as AAPL, or an SGX code ending .SI such as D05.SI.", quote: null };
      try { const quote = await fetchQuote(ctx, parsed.symbol); if (!quote) return { ok: false, message: "No exact US or SGX ticker match was accepted.", quote: null }; ctx.invalidateQueries(); return { ok: true, message: quote.feedState === "fresh" ? null : `Feed state: ${quote.feedState}. Values are not treated as current.`, quote }; }
      catch { const fallback = await cachedQuote(ctx, parsed.symbol, "down"); return { ok: fallback !== null, message: fallback ? "Live feed is down. Showing the last cached quote with alerts disabled." : "Price feed is down and no cached quote is available.", quote: fallback }; }
    },
  }),
  listWorkspace: defineAction({
    request: z.object({}), response: z.object({ ownerAccess: z.boolean(), analyses: z.array(analysisSchema), watchlist: z.array(watchItemSchema), alerts: z.array(alertSchema), quotes: z.array(quoteSchema), versions: z.array(versionSchema), audit: z.array(auditSchema), rubric: z.array(rubricSchema), formulaChecks: z.array(formulaCheckSchema), formulaChecksRunAt: z.string(), workspaceRetrievedAt: z.string(), alertHealth: healthSchema }),
    async handler(ctx) {
      const nowIso = new Date().toISOString();
      if (!ctx.viewer?.isOwner) return { ownerAccess: false, analyses: [], watchlist: [], alerts: [], quotes: [], versions: [], audit: [], rubric: QUALITY_RUBRIC, formulaChecks: formulaChecks(), formulaChecksRunAt: nowIso, workspaceRetrievedAt: nowIso, alertHealth: { scheduleLabel: "Hourly; market sessions only", deliveryChannel: "Muse chat", lastAttemptAt: null, lastSuccessAt: null, lastError: null, lastRefreshed: 0 } };
      const db = ctx.db<typeof schema>(); const [analyses, watchlist, alerts, quotes, versions, audit, healthRows] = await Promise.all([
        db.select().from(schema.analyses).orderBy(desc(schema.analyses.updatedAt)), db.select().from(schema.watchlist).orderBy(desc(schema.watchlist.updatedAt)), db.select().from(schema.alertEvents).orderBy(desc(schema.alertEvents.triggeredAt)).limit(40), db.select().from(schema.quoteCache).orderBy(desc(schema.quoteCache.updatedAt)).limit(100), db.select().from(schema.analysisVersions).orderBy(desc(schema.analysisVersions.createdAt)).limit(100), db.select().from(schema.auditEvents).orderBy(desc(schema.auditEvents.createdAt)).limit(100), db.select().from(schema.alertHealth).where(eq(schema.alertHealth.id, 1)).limit(1),
      ]);
      const health = healthRows[0];
      return { ownerAccess: true, analyses: analyses.map(mapAnalysis), watchlist: watchlist.map(mapWatch), alerts: alerts.map((row) => ({ id: row.id, symbol: row.symbol, kind: row.kind, threshold: row.threshold, price: row.price, deliveredAt: dateOrNull(row.deliveredAt), triggeredAt: row.triggeredAt.toISOString() })), quotes: quotes.map(mapCachedQuote), versions: versions.map(mapVersion), audit: audit.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })), rubric: QUALITY_RUBRIC, formulaChecks: formulaChecks(), formulaChecksRunAt: new Date().toISOString(), workspaceRetrievedAt: new Date().toISOString(), alertHealth: health ? { scheduleLabel: health.scheduleLabel, deliveryChannel: health.deliveryChannel, lastAttemptAt: dateOrNull(health.lastAttemptAt), lastSuccessAt: dateOrNull(health.lastSuccessAt), lastError: health.lastError, lastRefreshed: health.lastRefreshed } : { scheduleLabel: "Hourly; market sessions only", deliveryChannel: "Muse chat", lastAttemptAt: null, lastSuccessAt: null, lastError: null, lastRefreshed: 0 } };
    },
  }),
  saveAnalysis: defineAction({
    request: analysisInputSchema, response: z.object({ analysis: analysisSchema }),
    async handler(ctx, raw) {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>(); const parsed = normalizeInputSymbol(raw.symbol); if (!parsed) throw new Error("Ticker format is not accepted.");
      const input = { ...raw, symbol: parsed.symbol, market: parsed.market, name: raw.name.trim(), sourceUrl: safeHttpsUrl(raw.sourceUrl) };
      const valuation = calculateValuation(input); const quality = calculateQuality(input); const now = new Date();
      const existing = (await db.select().from(schema.analyses).where(eq(schema.analyses.symbol, input.symbol)).limit(1))[0]; const version = (existing?.analysisVersion ?? 0) + 1;
      const values = { ...input, ...valuation, sensitivityJson: JSON.stringify(valuation.sensitivity), ...quality, analysisVersion: version, updatedAt: now };
      await db.insert(schema.analyses).values({ ...values, createdAt: now }).onConflictDoUpdate({ target: schema.analyses.symbol, set: values });
      const row = (await db.select().from(schema.analyses).where(eq(schema.analyses.symbol, input.symbol)).limit(1))[0]; if (!row) throw new Error("This could not be saved.");
      await db.batch([db.insert(schema.analysisVersions).values({ symbol: input.symbol, version, snapshotJson: JSON.stringify(mapAnalysis(row)), createdAt: now }), db.insert(schema.auditEvents).values({ symbol: input.symbol, action: existing ? "updated" : "created", details: `Version ${version}; ${valuation.coveragePercent}% valuation coverage; ${quality.qualityComplete}/8 quality factors; source ${input.sourceLabel}.`, createdAt: now })]);
      ctx.invalidateQueries(); return { analysis: mapAnalysis(row) };
    },
  }),
  deleteAnalysis: defineAction({ request: z.object({ symbol: z.string().min(1) }), response: z.object({ ok: z.literal(true) }), async handler(ctx, args): Promise<{ ok: true }> { requireOwner(ctx); const parsed = normalizeInputSymbol(args.symbol); if (parsed) { const now = new Date(); const db = ctx.db<typeof schema>(); await db.batch([db.delete(schema.analyses).where(eq(schema.analyses.symbol, parsed.symbol)), db.insert(schema.auditEvents).values({ symbol: parsed.symbol, action: "deleted", details: "Removed current analysis; version history retained.", createdAt: now })]); } ctx.invalidateQueries(); return { ok: true }; } }),
  upsertWatchItem: defineAction({
    request: z.object({ symbol: z.string().min(1).max(20), name: z.string().min(1).max(160), market: marketSchema, currency: z.string().max(8).nullable(), targetBelow: nullableNumber, targetAbove: nullableNumber, latestPrice: nullableNumber, priceAsOf: z.string().nullable(), sourceUrl: z.string().nullable(), splitFactor: z.number().positive(), dividendAdjustment: z.number().finite(), adjustmentConfirmed: z.boolean() }), response: z.object({ item: watchItemSchema }),
    async handler(ctx, raw) { requireOwner(ctx); const parsed = normalizeInputSymbol(raw.symbol); if (!parsed) throw new Error("Ticker format is not accepted."); const db = ctx.db<typeof schema>(); const now = new Date(); const input = { ...raw, symbol: parsed.symbol, market: parsed.market, name: raw.name.trim(), sourceUrl: allowlistedSource(raw.sourceUrl).url, adjustmentConfirmed: raw.adjustmentConfirmed ? 1 : 0 }; await db.insert(schema.watchlist).values({ ...input, feedState: "stale", createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: schema.watchlist.symbol, set: { ...input, alertZone: null, updatedAt: now } }); const item = (await db.select().from(schema.watchlist).where(eq(schema.watchlist.symbol, parsed.symbol)).limit(1))[0]; if (!item) throw new Error("The watch item could not be saved."); ctx.invalidateQueries(); return { item: mapWatch(item) }; },
  }),
  removeWatchItem: defineAction({ request: z.object({ symbol: z.string().min(1) }), response: z.object({ ok: z.literal(true) }), async handler(ctx, args): Promise<{ ok: true }> { requireOwner(ctx); const parsed = normalizeInputSymbol(args.symbol); if (parsed) await ctx.db<typeof schema>().delete(schema.watchlist).where(eq(schema.watchlist.symbol, parsed.symbol)); ctx.invalidateQueries(); return { ok: true }; } }),
  refreshWatchlistQuotes: defineAction({
    request: z.object({ force: z.boolean().default(false) }), response: z.object({ ok: z.boolean(), refreshed: z.number(), skipped: z.boolean(), checkedAt: z.string(), failures: z.number(), notifications: z.array(z.object({ id: z.number(), message: z.string() })) }),
    async handler(ctx, args) {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>(); const now = new Date(); await db.update(schema.alertHealth).set({ lastAttemptAt: now }).where(eq(schema.alertHealth.id, 1));
      const sgxOpen = venueOpen(now, "SGX"); const usOpen = venueOpen(now, "US");
      if (!args.force && !sgxOpen && !usOpen) { return { ok: true, refreshed: 0, skipped: true, checkedAt: now.toISOString(), failures: 0, notifications: [] }; }
      const items = await db.select().from(schema.watchlist).limit(100); const eligible = args.force ? items : items.filter((item) => item.market === "SGX" ? sgxOpen : usOpen);
      let refreshed = 0; let failures = 0; const notifications: { id: number; message: string }[] = [];
      for (const item of eligible) {
        try {
          const quote = await fetchQuote(ctx, item.symbol); if (!quote || quote.price === null) throw new Error("No current quote returned.");
          const closedByProvider = providerSaysClosed(quote.marketStatus); const guarded = quote.feedState !== "fresh" || closedByProvider || item.adjustmentConfirmed !== 1;
          const comparablePrice = quote.price * item.splitFactor + item.dividendAdjustment; let zone: "below" | "above" | null = null; let threshold: number | null = null;
          if (!guarded && item.targetBelow !== null && comparablePrice <= item.targetBelow) { zone = "below"; threshold = item.targetBelow; }
          else if (!guarded && item.targetAbove !== null && comparablePrice >= item.targetAbove) { zone = "above"; threshold = item.targetAbove; }
          if (zone !== null && threshold !== null && zone !== item.alertZone) {
            const dedupeKey = `${item.symbol}:${zone}:${threshold}:${localDate(now, item.market)}`;
            await db.insert(schema.alertEvents).values({ symbol: item.symbol, kind: zone, threshold, price: comparablePrice, dedupeKey, triggeredAt: now }).onConflictDoNothing();
            const event = (await db.select().from(schema.alertEvents).where(eq(schema.alertEvents.dedupeKey, dedupeKey)).limit(1))[0]; if (event && event.deliveredAt === null) notifications.push({ id: event.id, message: `${item.symbol} moved ${zone} ${threshold.toFixed(2)} at adjusted price ${comparablePrice.toFixed(2)} ${item.currency ?? ""}.` });
          }
          await db.update(schema.watchlist).set({ name: quote.name, currency: quote.currency, latestPrice: quote.price, priceAsOf: quote.asOf, sourceUrl: quote.sourceUrl, alertZone: zone, feedState: quote.feedState, lastCheckedAt: now, lastSuccessAt: now, lastError: guarded ? (closedByProvider ? "Exchange calendar reports closed; alert held." : quote.feedState !== "fresh" ? "Stale quote; alert held." : "Corporate-action adjustment not confirmed; alert held.") : null, updatedAt: now }).where(eq(schema.watchlist.id, item.id)); refreshed += 1;
        } catch { failures += 1; await db.update(schema.watchlist).set({ feedState: "down", lastCheckedAt: now, lastError: "Feed refresh failed; cached price retained and alerts held.", updatedAt: now }).where(eq(schema.watchlist.id, item.id)); }
      }
      const error = failures > 0 ? `${failures} of ${eligible.length} eligible symbols failed; alerts were held for them.` : null;
      await db.update(schema.alertHealth).set({ lastSuccessAt: failures === 0 ? now : undefined, lastError: error, lastRefreshed: refreshed }).where(eq(schema.alertHealth.id, 1));
      const retained = await db.select({ id: schema.alertEvents.id }).from(schema.alertEvents).orderBy(desc(schema.alertEvents.id)).limit(100); const cutoff = retained[retained.length - 1]?.id; if (cutoff !== undefined) await db.delete(schema.alertEvents).where(lt(schema.alertEvents.id, cutoff));
      ctx.invalidateQueries(); return { ok: failures === 0, refreshed, skipped: false, checkedAt: now.toISOString(), failures, notifications };
    },
  }),
  markAlertsDelivered: defineAction({ request: z.object({ ids: z.array(z.number().int().positive()).max(100) }), response: z.object({ ok: z.literal(true) }), async handler(ctx, args): Promise<{ ok: true }> { requireOwner(ctx); const db = ctx.db<typeof schema>(); const now = new Date(); for (const id of args.ids) await db.update(schema.alertEvents).set({ deliveredAt: now }).where(eq(schema.alertEvents.id, id)); ctx.invalidateQueries(); return { ok: true }; } }),
} satisfies ActionsModule;
