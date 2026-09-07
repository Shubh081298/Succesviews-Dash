/**
 * currency.js — live foreign-exchange conversion to INR (the dashboard's reporting currency).
 *
 * Uses the free, key-less, CORS-enabled open.er-api.com feed (USD base, cross-rates for every
 * currency incl. AED/EUR/GBP…). We snapshot the rate at the moment a payment is recorded and
 * store it on the record, so historical reports never drift — the original amount/currency and
 * the exact rate + conversion date are all retained.
 *
 * Public API:
 *   await ensureRates()            → loads/caches the USD rate table (no-op if fresh)
 *   convertToINRSync(amount, cur)  → { inrAmount, rate, date, source } | null   (uses cached table)
 *   await convertToINR(amount,cur) → same, but fetches the table first if needed
 */

const LS_KEY = "svd_fx_usd_rates";
const TTL_MS = 12 * 60 * 60 * 1000; // refresh at most twice a day
const ENDPOINT = "https://open.er-api.com/v6/latest/USD";

let mem = null; // { rates: {CUR: perUSD}, ts: epochMs }

function loadCache() {
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const p = JSON.parse(raw); if (p && p.rates && p.ts) { mem = p; return mem; } }
  } catch (e) { /* ignore */ }
  return null;
}

function fresh(c) { return c && c.rates && (Date.now() - c.ts) < TTL_MS; }

export async function ensureRates() {
  const c = loadCache();
  if (fresh(c)) return c.rates;
  try {
    const res = await fetch(ENDPOINT, { cache: "no-store" });
    const data = await res.json();
    if (data && data.result === "success" && data.rates && data.rates.INR) {
      mem = { rates: data.rates, ts: Date.now() };
      try { localStorage.setItem(LS_KEY, JSON.stringify(mem)); } catch (e) { /* ignore */ }
      return mem.rates;
    }
  } catch (e) { /* network/offline — fall through */ }
  // Fall back to any cached table even if stale, so conversion still works offline.
  return c && c.rates ? c.rates : null;
}

const todayISO = () => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

// Convert using an already-loaded rate table (rates are "units per 1 USD").
export function convertToINRSync(amount, currency, ratesArg) {
  const amt = Number(amount);
  if (!Number.isFinite(amt)) return null;
  const cur = String(currency || "").toUpperCase();
  if (!cur || cur === "OTHER") return null;            // unknown currency — can't convert reliably
  if (cur === "INR") return { inrAmount: Math.round(amt * 100) / 100, rate: 1, date: todayISO(), source: "same" };
  const rates = ratesArg || (loadCache() || {}).rates;
  if (!rates || !rates.INR || !rates[cur]) return null;
  const rate = rates.INR / rates[cur];                 // INR per 1 unit of `cur`
  return { inrAmount: Math.round(amt * rate * 100) / 100, rate: Math.round(rate * 1e6) / 1e6, date: todayISO(), source: "live" };
}

export async function convertToINR(amount, currency) {
  const rates = await ensureRates();
  return convertToINRSync(amount, currency, rates);
}

// Format an INR value the Indian way (₹8,700.00).
export function formatINR(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " INR";
}
