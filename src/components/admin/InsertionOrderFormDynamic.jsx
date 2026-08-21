import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useAppData } from '../../data/AppDataContext';

/* ============================================================
   INSERTION ORDER — fully dynamic, multi-magazine templates.
   Every magazine keeps its own logo, watermark, accent color,
   company/contact info, perks and terms. Everything auto-saves
   to localStorage (key: svd_io_magazines) and reloads next time.
   Add unlimited magazines from the UI — no code changes needed.
   ============================================================ */

const LS_MAGS = 'svd_io_magazines';
const LS_CURRENT = 'svd_io_current';
const LS_DRAFT = 'svd_io_draft'; // last order form (auto-saved so the previous order is retained)
const LS_SAVED = 'svd_io_saved'; // saved insertion orders (local mirror so they always show, even if the DB write is unavailable)

const DEFAULT_PERKS = [
  "You'll be on the Cover page of the magazine.",
  '6-8 pages dedicated to your journey, achievements, and insights',
  'A professionally crafted article in Magazine.',
  'Promotion across social media platforms (LinkedIn, Instagram, Facebook)',
  'High-resolution PDF of your feature with reprint rights',
  'Official digital certificate of recognition',
  'Feature in our newsletter, reaching thousands of readers globally',
  'We will share the final edition globally through publication platforms.',
  'We publish the article on PR websites.',
];

const CIO_PERKS_HTML = `<ul>${DEFAULT_PERKS.map((p) => `<li>${p}</li>`).join('')}</ul>`;

// Supported currencies for the participation cost. Free-typed too, so any custom
// code works — the symbol is dropped and the code is spelled out when unknown.
const IO_CURRENCIES = ['USD', 'AED', 'INR', 'EUR', 'GBP', 'AUD', 'SGD', 'CAD'];
const IO_CUR_SYM = { USD: '$', AED: 'Dh', INR: '₹', EUR: '€', GBP: '£', AUD: 'A$', SGD: 'S$', CAD: 'C$' };
const IO_CUR_NAME = { USD: 'US Dollars', AED: 'UAE Dirham', INR: 'Indian Rupees', EUR: 'Euros', GBP: 'British Pounds', AUD: 'Australian Dollars', SGD: 'Singapore Dollars', CAD: 'Canadian Dollars' };
const curSym = (c) => IO_CUR_SYM[c] || '';
const curName = (c) => IO_CUR_NAME[c] || (c || 'USD');
// Formatted as: "<amount> <currency-code>" — e.g. "199 AED"
const fmtCost = (amount, c) => `${amount || '0'} ${c || 'USD'}`;

const CIO_TERMS_HTML =
  '<ol>' +
  '<li>CIO Visionaries is not liable for failure to publish or circulate any part of any issue(s) because of acts of God, strikes, work stoppages, national emergencies, or other circumstances beyond the control of the publisher.</li>' +
  '<li>CIO Visionaries obligation shall not exceed a refund of the amount paid to CIO Visionaries for the advertisement(s). Will not accept any cancellations.</li>' +
  '<li>It is up to the advertiser to contact us if the advertiser needs to change the ad material in an ongoing contract. The advertiser needs to contact CIO Visionaries at least two weeks before issue closing.</li>' +
  '</ol>';

/* Seed templates: CIO (from the original hardcoded values) + a blank AWL. */
const DEFAULT_MAGAZINES = () => [
  {
    id: 'cioVisionaries',
    name: 'CIO Visionaries',
    logoText: 'CIO',
    logoSubText: 'VISIONARIES',
    logoDataUrl: '',
    watermarkDataUrl: '',
    watermarkOpacity: 0.5,
    logoScale: 100,
    watermarkSize: 60,
    accentColor: '#D32F2F',
    repName: 'Ryan Scott',
    repTitle: 'Manager - Market Research',
    repEmail: 'ryan@ciovisionaries.com',
    website: 'www.ciovisionaries.com',
    footerEmail: 'info@ciovisionaries.com',
    docTitle: 'CONFIRMATION ORDER',
    acceptanceText: '',
    hClient: '', hPublisher: '', hAdvertising: '', hDeliverables: '',
    hCommercial: '', hPayment: '', hTerms: '', hAcceptance: '',
    payTerms: '100% advance payment',
    payMethod: 'Bank Transfer / Online Payment',
    perksHtml: CIO_PERKS_HTML,
    termsHtml: CIO_TERMS_HTML,
  },
  {
    id: 'awl',
    name: 'AWL',
    logoText: '',
    logoSubText: '',
    logoDataUrl: '',
    watermarkDataUrl: '',
    watermarkOpacity: 0.5,
    logoScale: 100,
    watermarkSize: 60,
    accentColor: '#1a1a1a',
    repName: '',
    repTitle: '',
    repEmail: '',
    website: '',
    footerEmail: '',
    docTitle: 'CONFIRMATION ORDER',
    acceptanceText: '',
    hClient: '', hPublisher: '', hAdvertising: '', hDeliverables: '',
    hCommercial: '', hPayment: '', hTerms: '', hAcceptance: '',
    payTerms: '100% advance payment',
    payMethod: 'Bank Transfer / Online Payment',
    perksHtml: '',
    termsHtml: '',
  },
];

const OPACITY_OPTIONS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

const todayStr = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const esc = (s = '') =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Drop unquestionably-broken/junk entries only:
//  • no name at all (can't be selected), or
//  • a pristine "New Magazine" placeholder left over from clicking Add without filling anything
//    (default name AND no contact AND no logo/watermark).
// Any magazine the user actually customised (renamed, added a rep, or a logo) is never touched.
const sanitizeMagazines = (arr) => {
  if (!Array.isArray(arr)) return [];
  const pristineNew = (m) =>
    String(m.name || '').trim() === 'New Magazine' &&
    !String(m.repName || '').trim() && !String(m.repEmail || '').trim() &&
    !m.logoDataUrl && !m.watermarkDataUrl;
  return arr.filter((m) => m && String(m.name || '').trim() !== '' && !pristineNew(m));
};

const loadMagazines = () => {
  try {
    const raw = localStorage.getItem(LS_MAGS);
    if (raw) {
      const arr = sanitizeMagazines(JSON.parse(raw));
      if (arr.length) return arr;
    }
  } catch (e) {
    /* fall back to defaults */
  }
  return DEFAULT_MAGAZINES();
};

/* ── WYSIWYG rich-text editor (bullets / numbering / bold / italic) ──
   Uncontrolled: initial HTML is captured once so the caret never jumps.
   Remount via `key` (on magazine switch) loads that magazine's content. */
function RichTextEditor({ initialHtml, onChange, placeholder }) {
  const ref = useRef(null);
  const initial = useRef(initialHtml || '');

  const exec = (command) => {
    document.execCommand(command, false, null);
    if (ref.current) {
      ref.current.focus();
      onChange(ref.current.innerHTML);
    }
  };

  return (
    <div className="sv-io-rte">
      <div className="sv-io-rte-toolbar">
        <button type="button" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}>
          <b>B</b>
        </button>
        <button type="button" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')}>
          <i>I</i>
        </button>
        <button
          type="button"
          title="Bullet list"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('insertUnorderedList')}
        >
          • List
        </button>
        <button
          type="button"
          title="Numbered list"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('insertOrderedList')}
        >
          1. List
        </button>
      </div>
      <div
        ref={ref}
        className="sv-io-rte-area"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: initial.current }}
      />
    </div>
  );
}

// Freeze the magazine fields that appear on the document, so a saved order can be
// reproduced exactly as it was downloaded even if the template later changes.
const magSnap = (m) => ({
  id: m.id, name: m.name, repName: m.repName, repTitle: m.repTitle, repEmail: m.repEmail,
  accentColor: m.accentColor, logoDataUrl: m.logoDataUrl, logoText: m.logoText, logoSubText: m.logoSubText,
  logoScale: m.logoScale, watermarkDataUrl: m.watermarkDataUrl, watermarkOpacity: m.watermarkOpacity,
  watermarkSize: m.watermarkSize, perksHtml: m.perksHtml, termsHtml: m.termsHtml,
  // document fields (footer + editable headings/text)
  website: m.website, footerEmail: m.footerEmail,
  docTitle: m.docTitle, acceptanceText: m.acceptanceText,
  hClient: m.hClient, hPublisher: m.hPublisher, hAdvertising: m.hAdvertising,
  hDeliverables: m.hDeliverables, hCommercial: m.hCommercial, hPayment: m.hPayment,
  hTerms: m.hTerms, hAcceptance: m.hAcceptance,
  payTerms: m.payTerms, payMethod: m.payMethod,
});

// Build the Confirmation Order document HTML from a magazine template + order data.
// Simplified single-page (A4) layout — every section heading, the acceptance text and
// the footer are editable per magazine. Reused by Download, re-open and the live preview.
function genOrderHtml(m, data, preview = false) {
  m = m || {}; data = data || {};
  const D = (v, def) => (v == null || String(v).trim() === '' ? def : v);
  const accent = m.accentColor || '#D32F2F';
  const cur = data.currency || 'USD';
  const num = (v) => { const n = Number(String(v).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };
  const money = (v) => `${num(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fee = num(data.cost);
  // Logo: uploaded image, else the text lockup.
  const logoHtml = m.logoDataUrl
    ? `<img src="${m.logoDataUrl}" style="max-height:60px;max-width:320px;object-fit:contain;display:block;" alt="" />`
    : `<span style="display:inline-flex;align-items:baseline;gap:10px;font-family:Georgia,'Times New Roman',serif;">
         <span style="font-size:38px;font-weight:800;color:${accent};line-height:1;">${esc(D(m.logoText, 'CIO'))}</span>
         <span style="font-size:27px;font-weight:800;letter-spacing:2px;color:#111;line-height:1;">${esc(D(m.logoSubText, 'VISIONARIES'))}</span>
       </span>`;
  const kv = (k, v) => `<div class="kv"><div class="k">${esc(k)}</div><div class="v">${esc(v || '—')}</div></div>`;
  const advRow = (k, v) => `<div class="adv"><div class="ak">${esc(k)}</div><div class="av">${esc(v || '—')}</div></div>`;
  // Editable, per-magazine section headings / text (fall back to sensible defaults).
  const hClient = D(m.hClient, 'Client Information');
  const hPublisher = D(m.hPublisher, 'Publisher Information');
  const hAdvertising = D(m.hAdvertising, 'Advertising / Editorial Details');
  const hDeliverables = D(m.hDeliverables, 'Deliverables');
  const hCommercial = D(m.hCommercial, 'Commercial Summary');
  const hPayment = D(m.hPayment, 'Payment Details');
  const hTerms = D(m.hTerms, 'Terms & Conditions');
  const hAcceptance = D(m.hAcceptance, 'Client Acceptance');
  const docTitle = D(m.docTitle, 'CONFIRMATION ORDER');
  const acceptanceText = D(m.acceptanceText,
    'By signing below, the client confirms acceptance of this Confirmation Order along with the terms and conditions mentioned above.');
  const payTerms = D(data.paymentTerms, D(m.payTerms, '100% advance payment'));
  const payMethod = D(data.paymentMethod, D(m.payMethod, 'Bank Transfer / Online Payment'));
  const footerSite = D(m.website, 'www.ciovisionaries.com');
  // Subtle background watermark — kept faint so it never hurts readability, and forced to
  // print via color-adjust. Uses the uploaded watermark image, else a faint logo-text mark.
  // Honor the opacity chosen in the magazine config (selector), defaulting to a subtle value.
  const wmOpacity = m.watermarkOpacity != null && m.watermarkOpacity !== '' ? Number(m.watermarkOpacity) : 0.08;
  const wmSize = Math.max(30, Math.min(Number(m.watermarkSize) || 52, 65));
  // Centered, fully contained watermark (never cropped): width caps at wmSize%, height caps so it
  // always fits the page. object-fit:contain keeps the aspect ratio.
  const watermarkHtml = m.watermarkDataUrl
    ? `<div class="wm"><img src="${m.watermarkDataUrl}" style="width:${wmSize}%;max-width:66%;max-height:55%;opacity:${wmOpacity};" alt="" /></div>`
    : `<div class="wm"><div class="wmtext" style="opacity:${wmOpacity};color:${accent};">${esc(D(m.logoText, 'CIO'))} ${esc(D(m.logoSubText, 'VISIONARIES'))}</div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=794, initial-scale=1, maximum-scale=1" />
<title>${esc(docTitle)}</title>
<style>
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  /* Lock mobile font inflation — without this, mobile browsers auto-enlarge the small
     print fonts, overflowing the A4 box onto a 2nd page. Keeps the PDF device-independent. */
  html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
  html,body{margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:10px;line-height:1.4;background:#fff}
  .wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:0;pointer-events:none}
  .wm img{max-width:66%;max-height:55%;height:auto;object-fit:contain}
  .wmtext{font-family:Georgia,'Times New Roman',serif;font-size:66px;font-weight:800;letter-spacing:5px;transform:rotate(-18deg);white-space:nowrap;text-align:center}
  .doc{position:relative;z-index:1;width:100%;max-width:794px;min-height:100vh;margin:0 auto;padding:16px 22px 10px;display:flex;flex-direction:column}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}
  .co-title{font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;letter-spacing:1px;text-align:right;color:#111;margin-bottom:6px;white-space:nowrap}
  .meta{display:grid;grid-template-columns:auto auto;column-gap:16px;row-gap:2px;justify-content:end;font-size:10px}
  .meta .mk{font-weight:700;color:#111}
  .meta .mv{color:#374151;text-align:right}
  .rule{position:relative;height:1px;background:#d1d5db;margin:10px 0 12px}
  .rule::before{content:'';position:absolute;left:0;top:-1px;height:3px;width:104px;background:${accent};border-radius:2px}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:11px}
  .panel{border:1px solid #e2e5ea;border-radius:5px;overflow:hidden}
  .panel-h{font-weight:700;font-size:11.5px;color:#111;padding:6px 10px;border-bottom:1px solid #eceef2;background:rgba(251,252,253,0.72)}
  .kv{display:grid;grid-template-columns:108px 1fr}
  .kv>div{padding:4px 10px;border-bottom:1px solid #f0f1f4;font-size:10px}
  .kv:last-child>div{border-bottom:none}
  .kv .k{font-weight:700;color:#111;border-right:1px solid #f0f1f4}
  .kv .v{color:#374151;word-break:break-word}
  .sec{border:1px solid #e2e5ea;border-radius:5px;margin-bottom:11px}
  .sec-h{font-weight:700;font-size:11.5px;color:#111;padding:6px 10px;border-bottom:1px solid #eceef2;background:rgba(251,252,253,0.72)}
  .adv{display:grid;grid-template-columns:140px 1fr;padding:4px 10px;font-size:10px;border-bottom:1px solid #f4f5f7}
  .adv:last-child{border-bottom:none}
  .adv .ak{font-weight:700;color:#111}
  .adv .av{color:#374151;word-break:break-word}
  .rich{padding:6px 12px;font-size:9.5px;color:#374151}
  .rich ul,.rich ol{margin:0;padding-left:16px}
  .rich li{padding:1px 0}
  .ctable{width:100%;border-collapse:collapse;font-size:10px}
  .ctable th,.ctable td{padding:5px 10px;border-bottom:1px solid #eceef2;text-align:left}
  .ctable th{background:rgba(248,250,252,0.72);font-weight:700;color:#111}
  .ctable td.amt,.ctable th.amt{text-align:right}
  .ctable tr.total td{font-weight:800;color:${accent};border-top:1px solid #e2e5ea}
  .pay{padding:2px 10px 8px}
  .pay .row{display:grid;grid-template-columns:120px 1fr;padding:4px 0;font-size:10px;border-bottom:1px solid #f4f5f7}
  .pay .row:last-child{border-bottom:none}
  .pay .pk{color:#6b7280}
  .pay .pv{color:#111;font-weight:600}
  .rich.terms ol,.rich.terms ul{padding-left:16px}
  .rich.terms li{padding:2px 0}
  .accept{padding:8px 12px;font-size:10px}
  .accept .intro{color:#374151;margin-bottom:10px}
  .accept .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;align-items:end}
  .accept .fld{display:flex;align-items:flex-end;gap:8px}
  .accept .fld .lbl{color:#111;font-weight:600;white-space:nowrap}
  .accept .fld .line{flex:1;border-bottom:1px solid #9ca3af;height:14px}
  .foot-wrap{margin-top:auto}
  .footer{border-top:2px solid ${accent};margin-top:12px;padding-top:7px;text-align:center;font-size:10.5px;font-weight:600;color:#374151}
  .bline{height:3px;background:${accent};border-radius:2px;margin-top:7px}
  /* Never split a section across pages. */
  .hdr,.cols,.sec,.panel,.accept,.foot-wrap,.ctable{break-inside:avoid;page-break-inside:avoid}
  @page{size:A4;margin:8mm}
  /* Print = fixed A4 box in millimetres, independent of screen/device width, so desktop and
     mobile produce the exact same single-page document. Screen keeps the responsive layout above. */
  @media print{
    html,body{width:210mm;background:#fff}
    .doc{width:194mm;max-width:194mm;min-height:273mm;margin:0;padding:0}
    .wm{position:fixed;inset:0}
  }
</style></head><body>
  ${watermarkHtml}
  <div class="doc">
    <div class="hdr">
      <div class="brand">
        ${logoHtml}
      </div>
      <div>
        <div class="co-title">${esc(docTitle)}</div>
        <div class="meta">
          <div class="mk">Order ID:</div><div class="mv">${esc(D(data.orderId, '—'))}</div>
          <div class="mk">Order Date:</div><div class="mv">${esc(D(data.date, '—'))}</div>
          <div class="mk">Edition:</div><div class="mv">${esc(D(data.edition, '—'))}</div>
        </div>
      </div>
    </div>
    <div class="rule"></div>

    <div class="cols">
      <div class="panel">
        <div class="panel-h">${esc(hClient)}</div>
        ${kv('Company', data.clientCompany)}
        ${kv('Contact Person', data.clientName)}
        ${kv('Designation', data.clientTitle)}
        ${kv('Email', data.clientEmail)}
      </div>
      <div class="panel">
        <div class="panel-h">${esc(hPublisher)}</div>
        ${kv('Contact Person', m.repName)}
        ${kv('Designation', m.repTitle)}
        ${kv('Email', m.repEmail)}
      </div>
    </div>

    <div class="sec">
      <div class="sec-h">${esc(hAdvertising)}</div>
      ${advRow('Feature Title', data.featureTitle)}
      ${advRow('Participation Type', D(data.participationType, 'Featured Leader / Editorial Feature'))}
      ${advRow('Publication', D(data.publication, m.name))}
    </div>

    <div class="cols">
      <div class="panel">
        <div class="panel-h">${esc(hDeliverables)}</div>
        <div class="rich">${m.perksHtml || '<ul></ul>'}</div>
      </div>
      <div class="panel">
        <div class="panel-h">${esc(hCommercial)}</div>
        <table class="ctable">
          <thead><tr><th>Description</th><th class="amt">Amount (${esc(cur)})</th></tr></thead>
          <tbody>
            <tr><td>Participation Fee</td><td class="amt">${money(fee)}</td></tr>
            <tr class="total"><td>Total Amount</td><td class="amt">${esc(cur)} ${money(fee)}</td></tr>
          </tbody>
        </table>
        <div class="panel-h" style="border-top:1px solid #eceef2;border-bottom:none;">${esc(hPayment)}</div>
        <div class="pay">
          <div class="row"><div class="pk">Payment Terms:</div><div class="pv">${esc(payTerms)}</div></div>
          <div class="row"><div class="pk">Payment Method:</div><div class="pv">${esc(payMethod)}</div></div>
          <div class="row"><div class="pk">Payment Currency:</div><div class="pv">${esc(cur)}</div></div>
        </div>
      </div>
    </div>

    <div class="sec">
      <div class="sec-h">${esc(hTerms)}</div>
      <div class="rich terms">${m.termsHtml || '<ul></ul>'}</div>
    </div>

    <div class="sec">
      <div class="sec-h">${esc(hAcceptance)}</div>
      <div class="accept">
        <div class="intro">${esc(acceptanceText)}</div>
        <div class="grid">
          <div class="fld"><span class="lbl">Client Name:</span><span class="line"></span></div>
          <div class="fld"><span class="lbl">Signature:</span><span class="line"></span></div>
          <div class="fld"><span class="lbl">Date:</span><span class="line"></span></div>
        </div>
      </div>
    </div>

    <div class="foot-wrap">
      <div class="footer">${esc(footerSite)}</div>
      <div class="bline"></div>
    </div>
  </div>
  ${preview ? '' : '<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},350);};</script>'}
</body></html>`;
}

export default function InsertionOrderForm({ onCapture, sharedMagazines = null, onSaveMagazines } = {}) {
  const { expenses = [], showToast, deleteExpense, loading } = useAppData();
  const reconciledRef = useRef(false);   // ensures the offline-queue flush runs only once per mount
  // Local mirror of saved orders so they always appear immediately and survive even if the
  // DB write is unavailable. Merged with any DB-backed insertion_order expenses (dedup by key).
  const [localSaved, setLocalSaved] = useState(() => {
    try { const r = localStorage.getItem(LS_SAVED); if (r) { const a = JSON.parse(r); if (Array.isArray(a)) return a; } } catch (e) { /* ignore */ }
    return [];
  });
  useEffect(() => { try { localStorage.setItem(LS_SAVED, JSON.stringify(localSaved)); } catch (e) { /* ignore */ } }, [localSaved]);

  // Reconciliation / offline-queue flush — runs once after the DB has loaded. Any locally-saved
  // order that isn't in the database yet (a previous save that failed, or was made offline) is
  // pushed to the DB now, so the database is the single source of truth across every browser/session.
  useEffect(() => {
    if (reconciledRef.current || loading || typeof onCapture !== 'function') return;
    reconciledRef.current = true;
    const dbKeys = new Set((expenses || []).filter((e) => e.type === 'insertion_order').map((e) => e.sourceKey).filter(Boolean));
    const pending = (localSaved || []).filter((r) => r && r.sourceKey && !dbKeys.has(r.sourceKey));
    if (!pending.length) return;
    (async () => {
      const okKeys = [];
      for (const r of pending) { try { if ((await onCapture(r)) === true) okKeys.push(r.sourceKey); } catch (e) { /* keep queued */ } }
      if (okKeys.length) setLocalSaved((prev) => (prev || []).map((x) => (okKeys.includes(x.sourceKey) ? { ...x, synced: true } : x)));
    })();
  }, [loading, expenses]);
  const savedOrders = (() => {
    const byKey = new Map();
    (localSaved || []).forEach((r) => { if (r) byKey.set(r.sourceKey || r.id, r); });
    (expenses || []).filter((e) => e.type === 'insertion_order').forEach((e) => { byKey.set(e.sourceKey || e.id, e); });
    return Array.from(byKey.values());
  })();
  const [showSaved, setShowSaved] = useState(false);
  const [busyDl, setBusyDl] = useState(false);
  const [magazines, setMagazines] = useState(loadMagazines);
  const hydratedRef = useRef(false);   // becomes true once DB config is applied
  const skipSaveRef = useRef(true);    // skip the initial mount + hydration echo when persisting to DB

  // Hydrate from the shared (DB) config as soon as it arrives — this is the
  // source of truth so PC and mobile stay in sync. Runs once.
  useEffect(() => {
    if (!hydratedRef.current && Array.isArray(sharedMagazines) && sharedMagazines.length) {
      hydratedRef.current = true;
      skipSaveRef.current = true; // don't immediately echo this back to the DB
      const clean = sanitizeMagazines(sharedMagazines);
      setMagazines(clean.length ? clean : sharedMagazines);
    }
  }, [sharedMagazines]);

  // Persist magazine edits to the shared DB store (debounced), so every device
  // sees the same logo/watermark. Skips the mount + hydration echo to avoid loops.
  useEffect(() => {
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
    if (!onSaveMagazines) return;
    const t = setTimeout(() => { onSaveMagazines(magazines); }, 700);
    return () => clearTimeout(t);
  }, [magazines]);
  const [currentId, setCurrentId] = useState(() => {
    try {
      const c = localStorage.getItem(LS_CURRENT);
      if (c) return c;
    } catch (e) {
      /* ignore */
    }
    return 'cioVisionaries';
  });

  // When editing a saved order, we "freeze" the magazine exactly as it was at
  // download time (contact person, logo, perks, terms) so the document reproduces
  // as downloaded even if the magazine template changed afterwards.
  const [orderSnap, setOrderSnap] = useState(null);
  // Identity of the saved order currently being edited (empty = composing a brand-new order).
  // While set, every form change auto-saves back to THIS record.
  const [editingKey, setEditingKey] = useState('');
  const [autoSaveState, setAutoSaveState] = useState('');   // '' | 'saving' | 'saved'
  const editMetaRef = useRef({ url: '', name: '', createdAt: '' }); // preserve file + created date across auto-saves
  const liveMag = magazines.find((m) => m.id === currentId) || magazines[0];
  const mag = orderSnap || liveMag;

  const BLANK_FORM = {
    // Stable, unique identity for THIS order. Generated once when a new order is first saved
    // and reused on every edit, so each order maps to exactly one DB row (source_key) —
    // new orders never collide/overwrite, and edits update in place.
    orderKey: '',
    date: todayStr(),
    orderId: '', edition: '',
    featureTitle: '',
    clientCompany: '', // record-only (not shown on the document)
    clientName: '', clientTitle: '', clientEmail: '',
    participationType: '', publication: '',
    cost: '199', currency: 'USD',
    paymentTerms: '', paymentMethod: '',
    repName: '', repTitle: '', repEmail: '', // per-order publisher contact (blank = magazine default)
  };
  // Restore the last worked-on order (auto-saved) so the previous order isn't lost on reload.
  const [form, setForm] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_DRAFT);
      if (raw) return { ...BLANK_FORM, ...JSON.parse(raw) };
    } catch (e) { /* ignore */ }
    return BLANK_FORM;
  });
  // Effective magazine for the document/preview — per-order contact person overrides the template.
  const docMag = {
    ...mag,
    repName: (form.repName || '').trim() || mag.repName,
    repTitle: (form.repTitle || '').trim() || mag.repTitle,
    repEmail: (form.repEmail || '').trim() || mag.repEmail,
  };

  /* ── Auto-save (only the changed magazine is rewritten in the array) ── */
  useEffect(() => {
    try {
      localStorage.setItem(LS_MAGS, JSON.stringify(magazines));
    } catch (e) {
      /* storage full / unavailable — ignore */
    }
  }, [magazines]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_CURRENT, currentId);
    } catch (e) {
      /* ignore */
    }
  }, [currentId]);

  // Auto-save the current order form as a draft so the previous order is retained.
  useEffect(() => {
    try {
      localStorage.setItem(LS_DRAFT, JSON.stringify(form));
    } catch (e) {
      /* ignore */
    }
  }, [form]);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const updateMag = (patch) =>
    setMagazines((prev) => prev.map((m) => (m.id === currentId ? { ...m, ...patch } : m)));

  const onImageUpload = (e, field) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateMag({ [field]: reader.result });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const addMagazine = () => {
    const id = 'mag_' + Date.now();
    setMagazines((prev) => [
      ...prev,
      {
        id,
        name: 'New Magazine',
        logoText: '',
        logoSubText: '',
        logoDataUrl: '',
        watermarkDataUrl: '',
        watermarkOpacity: 0.5,
        logoScale: 100,
        watermarkSize: 60,
        accentColor: '#1a1a1a',
        repName: '',
        repTitle: '',
        repEmail: '',
        perksHtml: '',
        termsHtml: '',
      },
    ]);
    setCurrentId(id);
  };

  const deleteMagazine = () => {
    if (magazines.length <= 1) {
      window.alert('At least one magazine template must exist.');
      return;
    }
    if (!window.confirm(`Delete magazine "${mag.name}"? This cannot be undone.`)) return;
    const remaining = magazines.filter((m) => m.id !== currentId);
    setMagazines(remaining);
    setCurrentId(remaining[0].id);
  };

  const accent = mag.accentColor || '#1a1a1a';
  const logoScale = (mag.logoScale || 100) / 100;
  const wmSize = mag.watermarkSize || 60;

  /* ── Header logo markup shared by preview + PDF ── */
  const renderLogo = () => {
    if (mag.logoDataUrl) {
      return (
        <img
          className="sv-io-logo-img"
          src={mag.logoDataUrl}
          alt={mag.name}
          style={{ maxHeight: 64 * logoScale, maxWidth: 240 * logoScale }}
        />
      );
    }
    if (mag.logoText || mag.logoSubText) {
      return (
        <>
          <span className="sv-io-logo-main" style={{ color: accent, fontSize: 34 * logoScale }}>
            {mag.logoText}
          </span>
          <span className="sv-io-logo-sub" style={{ fontSize: 16 * logoScale }}>
            {mag.logoSubText}
          </span>
        </>
      );
    }
    return (
      <span className="sv-io-logo-main" style={{ color: accent, fontSize: 34 * logoScale }}>
        {mag.name}
      </span>
    );
  };

  // Delete a saved insertion order — from the local mirror and (if it's a DB row) the ledger.
  const deleteSaved = async (rec) => {
    if (!rec) return;
    if (!window.confirm(`Delete this saved insertion order${rec.clientName ? ` for ${rec.clientName}` : ''}? This cannot be undone.`)) return;
    // remove from the local mirror (match by id or sourceKey)
    setLocalSaved((prev) => (prev || []).filter((x) => x.id !== rec.id && (x.sourceKey || '') !== (rec.sourceKey || '__none__')));
    // remove from the DB ledger if it exists there (DB rows have a uuid id; local-only ids start with "io_")
    const isDbRow = rec.id && !String(rec.id).startsWith('io_');
    if (isDbRow && typeof deleteExpense === 'function') { try { await deleteExpense(rec.id); } catch (e) { /* local already removed */ } }
    showToast && showToast('Insertion order deleted.', 'success');
  };

  // Re-open (regenerate) a saved insertion order from its stored data.
  const reopenSaved = (rec) => {
    const dd = rec.details || {};
    // Prefer the frozen snapshot (exactly as downloaded); fall back to matching magazine.
    const m = dd.magSnapshot || magazines.find((x) => x.name === dd.magazine) || mag;
    const html = genOrderHtml(m, {
      orderId: dd.orderId || dd.confirmationNo || '',
      date: rec.paymentDate || (dd.generatedAt ? String(dd.generatedAt).slice(0, 10) : ''),
      edition: dd.edition || '',
      clientCompany: dd.companyName || '',
      clientName: dd.clientName || rec.clientName || '',
      clientTitle: dd.clientTitle || '', clientEmail: dd.clientEmail || '',
      featureTitle: dd.featureTitle || '', participationType: dd.participationType || '',
      publication: dd.publication || '',
      cost: rec.amount != null ? rec.amount : (dd.contractValue || ''),
      currency: rec.currency || dd.currency || 'USD',
      paymentTerms: dd.paymentTerms || '', paymentMethod: dd.paymentMethod || '',
    });
    const w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  };

  // Load a saved insertion order back into the form so the admin can edit it
  // (e.g. client asked for changes) and download an updated copy.
  const editSaved = (rec) => {
    const dd = rec.details || {};
    const snap = dd.magSnapshot || {};
    setForm({
      // Reuse the saved order's stable identity so editing updates the SAME row (never a duplicate).
      orderKey: dd.orderKey || rec.sourceKey || '',
      date: rec.paymentDate || (dd.generatedAt ? String(dd.generatedAt).slice(0, 10) : todayStr()),
      orderId: dd.orderId || '',
      edition: dd.edition || '',
      featureTitle: dd.featureTitle || '',
      clientCompany: dd.companyName || '',
      clientName: dd.clientName || rec.clientName || '',
      clientTitle: dd.clientTitle || '',
      clientEmail: dd.clientEmail || '',
      participationType: dd.participationType || '',
      publication: dd.publication || '',
      cost: rec.amount != null ? String(rec.amount) : (dd.contractValue || ''),
      currency: rec.currency || dd.currency || 'USD',
      paymentTerms: dd.paymentTerms || '',
      paymentMethod: dd.paymentMethod || '',
      // Show the Publisher Information exactly as saved on this order (editable). Prefer the raw
      // per-order override the user typed; otherwise the value shown on the saved document.
      repName: dd.repOverrideName || dd.repName || snap.repName || '',
      repTitle: dd.repOverrideTitle || dd.repTitle || snap.repTitle || '',
      repEmail: dd.repOverrideEmail || dd.repEmail || snap.repEmail || '',
    });
    const mm = magazines.find((x) => x.name === dd.magazine);
    if (mm) setCurrentId(mm.id);
    // Freeze the magazine exactly as it was on this saved order (contact person, logo,
    // perks, terms) so the edited copy keeps the same details unless the user switches magazine.
    setOrderSnap(dd.magSnapshot || null);
    // From now on, edits to THIS order auto-save back to the same record (no re-click needed).
    setEditingKey(dd.orderKey || rec.sourceKey || '');
    editMetaRef.current = { url: dd.invoiceUrl || '', name: dd.invoiceName || '', createdAt: rec.createdAt || dd.generatedAt || '' };
    setAutoSaveState('');
    setShowSaved(false);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { /* ignore */ }
  };

  // Build the data object (order + client + advertising + commercial) for the document.
  const orderData = (orderId) => ({
    orderId: orderId || form.orderId, date: form.date, edition: form.edition,
    clientCompany: form.clientCompany,
    clientName: form.clientName, clientTitle: form.clientTitle, clientEmail: form.clientEmail,
    featureTitle: form.featureTitle, participationType: form.participationType, publication: form.publication,
    cost: form.cost, currency: form.currency,
    paymentTerms: form.paymentTerms, paymentMethod: form.paymentMethod,
  });

  // Build the order document + its identifiers (shared by Download and Save-to-memory).
  const genOrderKey = () => `io_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const buildOrder = () => {
    const dt0 = new Date(form.date || Date.now());
    const fyStart0 = dt0.getMonth() >= 3 ? dt0.getFullYear() : dt0.getFullYear() - 1;
    const fy0 = `${String(fyStart0).slice(2)}-${String(fyStart0 + 1).slice(2)}`;
    // Stable, unique identity for THIS order. Generated once, then reused on every edit so the
    // order maps to exactly one DB row — new orders never overwrite each other and edits update
    // in place. Replaces the old client+date+magazine key that caused collisions/overwrites.
    let orderKey = (form.orderKey || '').trim();
    if (!orderKey) { orderKey = genOrderKey(); setForm((p) => ({ ...p, orderKey })); }
    const src = orderKey;
    // Confirmation number: keep the existing one on edit; otherwise derive a stable value from the
    // unique key (stable across edits, unique across orders — no more duplicate SV/.. numbers).
    let hash = 0; for (let i = 0; i < orderKey.length; i++) hash = (hash * 31 + orderKey.charCodeAt(i)) & 0xffff;
    const confNo = (form.orderId || '').trim() || `SV/${fy0}/${String((hash % 900) + 100)}`;
    const orderId = confNo;
    const html = genOrderHtml(docMag, orderData(orderId));
    return { html, confNo, src, orderId, orderKey };
  };

  // Build the saved-order record from the CURRENT form + resolved doc magazine. Shared by the
  // explicit Save/Download path and the edit auto-save path so both persist identical data —
  // in particular the exact Publisher Information the user sees (docMag = per-order override,
  // else the magazine default) is what gets stored, and restored verbatim on the next edit.
  const buildRecord = ({ confNo, orderId, orderKey, fileUrl, fileName, createdAt }) => ({
    id: orderKey || `io_${Date.now()}`,
    createdAt: createdAt || new Date().toISOString(),
    type: 'insertion_order',
    sourceKey: orderKey,
    title: form.featureTitle || form.clientName || 'Insertion Order',
    category: 'Insertion Order',
    clientName: form.clientName || '',
    contractOrder: confNo,
    paymentStatus: 'Pending',
    paymentDate: form.date || '',
    amount: form.cost === '' ? null : Number(form.cost),
    currency: form.currency || 'USD',
    details: {
      orderKey: orderKey,          // stable identity, mirrored into details for reopen/edit
      confirmationNo: confNo,
      contractNo: confNo,
      orderId,
      clientName: form.clientName || '',
      companyName: form.clientCompany || '',
      clientTitle: form.clientTitle || '',
      clientEmail: form.clientEmail || '',
      featureTitle: form.featureTitle || '',
      edition: form.edition || '',
      participationType: form.participationType || '',
      publication: form.publication || '',
      paymentTerms: form.paymentTerms || '',
      paymentMethod: form.paymentMethod || '',
      magazine: mag.name || '',
      generatedAt: new Date().toISOString(),
      contractValue: form.cost || '',
      currency: form.currency || 'USD',
      orderStatus: 'Downloaded',
      paymentStatus: 'Pending',
      invoiceUrl: fileUrl || '',
      invoiceName: fileName || (`Confirmation Order ${confNo}`),
      // Persist BOTH the raw per-order override (so a blank stays blank on the next edit) and the
      // resolved value actually shown on the document.
      repOverrideName: (form.repName || '').trim(),
      repOverrideTitle: (form.repTitle || '').trim(),
      repOverrideEmail: (form.repEmail || '').trim(),
      repName: docMag.repName || '', repTitle: docMag.repTitle || '', repEmail: docMag.repEmail || '',
      magSnapshot: magSnap(docMag),
    },
  });

  // Persist a generated order to storage + the Saved Insertion Orders list (DB source of truth).
  const persistOrder = async ({ html, confNo, src, orderId, orderKey }) => {
    let fileUrl = '', fileName = '';
    try {
      setBusyDl(true);
      const safe = `confirmation-order-${confNo.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.html`;
      const path = `insertion-orders/${safe}`;
      const { error } = await supabase.storage.from('design-files').upload(path, new Blob([html], { type: 'text/html' }), { upsert: false });
      if (!error) { fileUrl = supabase.storage.from('design-files').getPublicUrl(path).data.publicUrl; fileName = `Confirmation Order ${confNo}.html`; }
    } catch (e) { /* upload optional — record still captured */ }
    finally { setBusyDl(false); }
    const rec = buildRecord({ confNo, orderId, orderKey: orderKey || src, fileUrl, fileName });
    // DB write is the SOURCE OF TRUTH — await it and know whether it actually persisted.
    let synced = false;
    if (typeof onCapture === 'function') {
      try { synced = (await onCapture(rec)) === true; } catch (e) { synced = false; }
    }
    // Local mirror doubles as an offline queue; dedup by the stable orderKey (no duplicates).
    setLocalSaved((prev) => [{ ...rec, synced }, ...(prev || []).filter((x) => (x.sourceKey || '') !== rec.sourceKey)]);
    // Editing this order from now on auto-saves silently to the same record.
    setEditingKey(rec.sourceKey);
    editMetaRef.current = { url: fileUrl, name: fileName, createdAt: rec.createdAt };
    if (synced) showToast && showToast('Saved to Insertion Orders.', 'success');
    else showToast && showToast('Saved locally — could not reach the database. It will sync automatically when the connection is back.', 'error');
  };

  // ── Auto-save while editing a saved order ──
  // Any change to the form is debounced and written back to the SAME record (by its stable
  // orderKey) — no need to click Save again. Skips the HTML re-upload (reuses the saved file);
  // Download still regenerates the document when the user wants a fresh copy.
  useEffect(() => {
    if (!editingKey) return;
    setAutoSaveState('saving');
    const t = setTimeout(async () => {
      const dt0 = new Date(form.date || Date.now());
      const fyStart0 = dt0.getMonth() >= 3 ? dt0.getFullYear() : dt0.getFullYear() - 1;
      const fy0 = `${String(fyStart0).slice(2)}-${String(fyStart0 + 1).slice(2)}`;
      let hash = 0; for (let i = 0; i < editingKey.length; i++) hash = (hash * 31 + editingKey.charCodeAt(i)) & 0xffff;
      const confNo = (form.orderId || '').trim() || `SV/${fy0}/${String((hash % 900) + 100)}`;
      const rec = buildRecord({ confNo, orderId: confNo, orderKey: editingKey, fileUrl: editMetaRef.current.url, fileName: editMetaRef.current.name, createdAt: editMetaRef.current.createdAt });
      let ok = false;
      if (typeof onCapture === 'function') { try { ok = (await onCapture(rec)) === true; } catch (e) { ok = false; } }
      setLocalSaved((prev) => [{ ...rec, synced: ok }, ...(prev || []).filter((x) => (x.sourceKey || '') !== editingKey)]);
      setAutoSaveState(ok ? 'saved' : 'error');
    }, 900);
    return () => clearTimeout(t);
  }, [form, editingKey]);

  /* ── Download: open the print dialog, then ask whether to save to memory ── */
  const handleDownload = async () => {
    const order = buildOrder();
    const w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(order.html); w.document.close(); }
    if (window.confirm('Save this confirmation order to memory?\n\nIt will be added to Saved Insertion Orders.')) {
      await persistOrder(order);
      setShowSaved(true); // land directly in the Saved section
    }
  };

  /* ── Save to memory (no print) — with Yes/No confirmation, lands in Saved ── */
  const handleSaveToMemory = async () => {
    if (!window.confirm('Save this confirmation order to Saved Insertion Orders (memory)?')) return;
    await persistOrder(buildOrder());
    setShowSaved(true);
  };

  return (
    <div className="sv-io-wrap">
      {/* ── Magazine selector + Add ── */}
      <div className="sv-io-brand-row">
        <label className="sv-form-label">Select Magazine</label>
        <div className="sv-io-brand-controls">
          <select
            className="sv-input"
            value={liveMag.id}
            onChange={(e) => {
              const id = e.target.value;
              setCurrentId(id); setOrderSnap(null);
              // Seed the per-order Publisher fields from the chosen magazine so what shows on the
              // document is an explicit, editable value (not a hidden fallback) that saves as-is.
              const nm = magazines.find((m) => m.id === id);
              if (nm) setForm((p) => ({ ...p, repName: nm.repName || '', repTitle: nm.repTitle || '', repEmail: nm.repEmail || '' }));
            }}
          >
            {magazines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || 'Untitled'}
              </option>
            ))}
          </select>
          <button type="button" className="sv-btn-outline" onClick={addMagazine}>
            + Add Magazine
          </button>
          <button
            type="button"
            className="sv-btn-outline sv-io-del-mag"
            onClick={deleteMagazine}
            disabled={magazines.length <= 1}
            title={magazines.length <= 1 ? 'At least one magazine must exist' : 'Delete this magazine'}
          >
            🗑 Delete
          </button>
        </div>
      </div>

      {orderSnap && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, margin: '10px 0' }}>
          <span>✎ Editing a saved order — showing the contact person & template <b>exactly as it was downloaded</b> ({orderSnap.repName || 'saved contact'}). Editing client details and re-downloading keeps this.</span>
          <button type="button" onClick={() => setOrderSnap(null)} style={{ marginLeft: 'auto', border: 'none', background: '#2563EB', color: '#fff', borderRadius: 8, padding: '4px 10px', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Use current template</button>
        </div>
      )}

      <div className="sv-io-grid">
        {/* ── LEFT: FORM ── */}
        <div className="sv-io-left-col">
          {/* Order details — unchanged working fields */}
          <div className="sv-card sv-io-form-card">
            <h3 className="sv-io-section-title">Insertion order details</h3>

            <div className="sv-io-field">
              <label className="sv-form-label">Date</label>
              <input
                className="sv-input"
                type="text"
                value={form.date}
                onChange={(e) => updateField('date', e.target.value)}
              />
            </div>

            <div className="sv-io-field">
              <label className="sv-form-label">Feature title</label>
              <input
                className="sv-input"
                type="text"
                placeholder='"The 10 Most Influential ... in 2025."'
                value={form.featureTitle}
                onChange={(e) => updateField('featureTitle', e.target.value)}
              />
            </div>

            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Client company</label>
                <input
                  className="sv-input"
                  type="text"
                  placeholder="Riskmindz"
                  value={form.clientCompany}
                  onChange={(e) => updateField('clientCompany', e.target.value)}
                />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Client name</label>
                <input
                  className="sv-input"
                  type="text"
                  placeholder="Sachin Singh"
                  value={form.clientName}
                  onChange={(e) => updateField('clientName', e.target.value)}
                />
              </div>
            </div>

            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Client title</label>
                <input
                  className="sv-input"
                  type="text"
                  placeholder="Founder"
                  value={form.clientTitle}
                  onChange={(e) => updateField('clientTitle', e.target.value)}
                />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Client email</label>
                <input
                  className="sv-input"
                  type="email"
                  placeholder="sachin@riskmindz.com"
                  value={form.clientEmail}
                  onChange={(e) => updateField('clientEmail', e.target.value)}
                />
              </div>
            </div>

            <div className="sv-io-field" style={{ marginTop: 4 }}>
              <label className="sv-form-label">Contact person — this order <span style={{ color: '#94A3B8', fontWeight: 500 }}>(from {mag.name}; leave blank to use the default)</span></label>
              <div className="sv-flex sv-gap-2">
                <input className="sv-input" placeholder={mag.repName || 'Name'} value={form.repName} onChange={(e) => updateField('repName', e.target.value)} />
                <input className="sv-input" placeholder={mag.repTitle || 'Title'} value={form.repTitle} onChange={(e) => updateField('repTitle', e.target.value)} />
              </div>
              <input className="sv-input" style={{ marginTop: 8 }} type="email" placeholder={mag.repEmail || 'Email'} value={form.repEmail} onChange={(e) => updateField('repEmail', e.target.value)} />
            </div>

            <div className="sv-io-field">
              <label className="sv-form-label">Participation cost</label>
              <div className="sv-flex sv-gap-2">
                <input
                  className="sv-input"
                  type="text"
                  placeholder="199"
                  value={form.cost}
                  onChange={(e) => updateField('cost', e.target.value)}
                  style={{ flex: 2 }}
                />
                <input
                  className="sv-input"
                  list="io-cur-list"
                  value={form.currency}
                  onChange={(e) => updateField('currency', e.target.value.toUpperCase())}
                  placeholder="USD"
                  style={{ flex: 1, minWidth: 90 }}
                />
                <datalist id="io-cur-list">
                  {IO_CURRENCIES.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>

            {/* Order meta — top-right of the document */}
            <h4 className="sv-io-subhead">Order meta</h4>
            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Order ID <span style={{ color: '#94A3B8', fontWeight: 500 }}>(blank = auto)</span></label>
                <input className="sv-input" type="text" placeholder="Auto (SV/25-26/xxx)" value={form.orderId} onChange={(e) => updateField('orderId', e.target.value)} />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Edition</label>
                <input className="sv-input" type="text" placeholder="e.g. September 2026" value={form.edition} onChange={(e) => updateField('edition', e.target.value)} />
              </div>
            </div>

            {/* Advertising / editorial details */}
            <h4 className="sv-io-subhead">Advertising / editorial details <span style={{ color: '#94A3B8', fontWeight: 500, fontSize: 11 }}>(blank = sensible default)</span></h4>
            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Participation type</label>
                <input className="sv-input" type="text" placeholder="Featured Leader / Editorial Feature" value={form.participationType} onChange={(e) => updateField('participationType', e.target.value)} />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Publication</label>
                <input className="sv-input" type="text" placeholder={mag.name} value={form.publication} onChange={(e) => updateField('publication', e.target.value)} />
              </div>
            </div>

            {/* Payment details */}
            <h4 className="sv-io-subhead">Payment details <span style={{ color: '#94A3B8', fontWeight: 500, fontSize: 11 }}>(blank = magazine default)</span></h4>
            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Payment terms</label>
                <input className="sv-input" type="text" placeholder={liveMag.payTerms || '100% advance payment'} value={form.paymentTerms} onChange={(e) => updateField('paymentTerms', e.target.value)} />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Payment method</label>
                <input className="sv-input" type="text" placeholder={liveMag.payMethod || 'Bank Transfer / Online Payment'} value={form.paymentMethod} onChange={(e) => updateField('paymentMethod', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Magazine template — dynamic brand configuration */}
          <div className="sv-card sv-io-form-card">
            <h3 className="sv-io-section-title">Magazine template</h3>

            <div className="sv-io-field">
              <label className="sv-form-label">Magazine / brand name</label>
              <input
                className="sv-input"
                type="text"
                placeholder="e.g. CIO Visionaries"
                value={liveMag.name}
                onChange={(e) => updateMag({ name: e.target.value })}
              />
            </div>

            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Header text — main</label>
                <input
                  className="sv-input"
                  type="text"
                  placeholder="CIO"
                  value={liveMag.logoText}
                  onChange={(e) => updateMag({ logoText: e.target.value })}
                />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Header text — subtitle</label>
                <input
                  className="sv-input"
                  type="text"
                  placeholder="VISIONARIES"
                  value={liveMag.logoSubText}
                  onChange={(e) => updateMag({ logoSubText: e.target.value })}
                />
              </div>
            </div>

            {/* Logo upload */}
            <div className="sv-io-field">
              <label className="sv-form-label">Logo (overrides header text when uploaded)</label>
              <div className="sv-io-upload-row">
                <label className="sv-btn-outline sv-io-upload-btn">
                  Upload logo
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => onImageUpload(e, 'logoDataUrl')}
                  />
                </label>
                {mag.logoDataUrl && (
                  <>
                    <img className="sv-io-thumb" src={mag.logoDataUrl} alt="logo preview" />
                    <button
                      type="button"
                      className="sv-io-perk-remove"
                      onClick={() => { if (window.confirm('Remove this logo?')) updateMag({ logoDataUrl: '' }); }}
                      aria-label="Remove logo"
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Watermark upload + opacity */}
            <div className="sv-io-field">
              <label className="sv-form-label">Favicon / watermark</label>
              <div className="sv-io-upload-row">
                <label className="sv-btn-outline sv-io-upload-btn">
                  Upload watermark
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => onImageUpload(e, 'watermarkDataUrl')}
                  />
                </label>
                {mag.watermarkDataUrl && (
                  <>
                    <img className="sv-io-thumb" src={mag.watermarkDataUrl} alt="watermark preview" />
                    <button
                      type="button"
                      className="sv-io-perk-remove"
                      onClick={() => { if (window.confirm('Remove this watermark?')) updateMag({ watermarkDataUrl: '' }); }}
                      aria-label="Remove watermark"
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Watermark opacity</label>
                <select
                  className="sv-input"
                  value={liveMag.watermarkOpacity}
                  onChange={(e) => updateMag({ watermarkOpacity: parseFloat(e.target.value) })}
                >
                  {OPACITY_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {Math.round(o * 100)}%
                    </option>
                  ))}
                </select>
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Brand accent color</label>
                <div className="sv-io-color-row">
                  <input
                    type="color"
                    className="sv-io-color"
                    value={liveMag.accentColor}
                    onChange={(e) => updateMag({ accentColor: e.target.value })}
                  />
                  <input
                    className="sv-input"
                    type="text"
                    value={liveMag.accentColor}
                    onChange={(e) => updateMag({ accentColor: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Logo & watermark size */}
            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Logo size — {mag.logoScale || 100}%</label>
                <input
                  type="range"
                  min="40"
                  max="200"
                  step="5"
                  value={liveMag.logoScale || 100}
                  onChange={(e) => updateMag({ logoScale: parseInt(e.target.value, 10) })}
                />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Watermark size — {mag.watermarkSize || 60}%</label>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={liveMag.watermarkSize || 60}
                  onChange={(e) => updateMag({ watermarkSize: parseInt(e.target.value, 10) })}
                />
              </div>
            </div>

            {/* Company / contact block */}
            <div className="sv-io-field">
              <label className="sv-form-label">Contact person</label>
              <input
                className="sv-input"
                type="text"
                placeholder="Ryan Scott"
                value={liveMag.repName}
                onChange={(e) => updateMag({ repName: e.target.value })}
              />
            </div>
            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Designation</label>
                <input
                  className="sv-input"
                  type="text"
                  placeholder="Manager - Market Research"
                  value={liveMag.repTitle}
                  onChange={(e) => updateMag({ repTitle: e.target.value })}
                />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Email</label>
                <input
                  className="sv-input"
                  type="email"
                  placeholder="ryan@ciovisionaries.com"
                  value={liveMag.repEmail}
                  onChange={(e) => updateMag({ repEmail: e.target.value })}
                />
              </div>
            </div>
            {/* Payment defaults for this magazine (per-order can still override) */}
            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Payment terms <span style={{ color: '#94A3B8', fontWeight: 500 }}>(default)</span></label>
                <input className="sv-input" type="text" placeholder="100% advance payment" value={liveMag.payTerms || ''} onChange={(e) => updateMag({ payTerms: e.target.value })} />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Payment method <span style={{ color: '#94A3B8', fontWeight: 500 }}>(default)</span></label>
                <input className="sv-input" type="text" placeholder="Bank Transfer / Online Payment" value={liveMag.payMethod || ''} onChange={(e) => updateMag({ payMethod: e.target.value })} />
              </div>
            </div>

            {/* Footer — centered website only */}
            <h4 className="sv-io-subhead">Footer</h4>
            <div className="sv-io-field">
              <label className="sv-form-label">Website <span style={{ color: '#94A3B8', fontWeight: 500 }}>(shown centered at the bottom)</span></label>
              <input className="sv-input" type="text" placeholder="www.ciovisionaries.com" value={liveMag.website || ''} onChange={(e) => updateMag({ website: e.target.value })} />
            </div>

            {/* Perks / Deliverables — rich text */}
            <div className="sv-io-field">
              <label className="sv-form-label">Deliverables <span style={{ color: '#94A3B8', fontWeight: 500 }}>(editable bullets)</span></label>
              <RichTextEditor
                key={`perks-${mag.id}`}
                initialHtml={mag.perksHtml}
                placeholder="Add deliverables — use bullets or numbering…"
                onChange={(html) => updateMag({ perksHtml: html })}
              />
            </div>

            {/* Terms — rich text */}
            <div className="sv-io-field">
              <label className="sv-form-label">Terms &amp; Conditions</label>
              <RichTextEditor
                key={`terms-${mag.id}`}
                initialHtml={mag.termsHtml}
                placeholder="Add terms — paragraphs, bullets or numbering…"
                onChange={(html) => updateMag({ termsHtml: html })}
              />
            </div>

            {/* Editable section headings + acceptance text (per magazine) */}
            <h4 className="sv-io-subhead">Section headings <span style={{ color: '#94A3B8', fontWeight: 500, fontSize: 11 }}>(blank = default)</span></h4>
            <div className="sv-io-field">
              <label className="sv-form-label">Document title</label>
              <input className="sv-input" type="text" placeholder="CONFIRMATION ORDER" value={liveMag.docTitle || ''} onChange={(e) => updateMag({ docTitle: e.target.value })} />
            </div>
            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Client Information</label>
                <input className="sv-input" type="text" placeholder="Client Information" value={liveMag.hClient || ''} onChange={(e) => updateMag({ hClient: e.target.value })} />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Publisher Information</label>
                <input className="sv-input" type="text" placeholder="Publisher Information" value={liveMag.hPublisher || ''} onChange={(e) => updateMag({ hPublisher: e.target.value })} />
              </div>
            </div>
            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Advertising / Editorial</label>
                <input className="sv-input" type="text" placeholder="Advertising / Editorial Details" value={liveMag.hAdvertising || ''} onChange={(e) => updateMag({ hAdvertising: e.target.value })} />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Deliverables</label>
                <input className="sv-input" type="text" placeholder="Deliverables" value={liveMag.hDeliverables || ''} onChange={(e) => updateMag({ hDeliverables: e.target.value })} />
              </div>
            </div>
            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Commercial Summary</label>
                <input className="sv-input" type="text" placeholder="Commercial Summary" value={liveMag.hCommercial || ''} onChange={(e) => updateMag({ hCommercial: e.target.value })} />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Payment Details</label>
                <input className="sv-input" type="text" placeholder="Payment Details" value={liveMag.hPayment || ''} onChange={(e) => updateMag({ hPayment: e.target.value })} />
              </div>
            </div>
            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Terms &amp; Conditions</label>
                <input className="sv-input" type="text" placeholder="Terms & Conditions" value={liveMag.hTerms || ''} onChange={(e) => updateMag({ hTerms: e.target.value })} />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Client Acceptance</label>
                <input className="sv-input" type="text" placeholder="Client Acceptance" value={liveMag.hAcceptance || ''} onChange={(e) => updateMag({ hAcceptance: e.target.value })} />
              </div>
            </div>
            <div className="sv-io-field">
              <label className="sv-form-label">Acceptance statement</label>
              <textarea className="sv-input" rows={2} placeholder="By signing below, the client confirms acceptance of this Confirmation Order…" value={liveMag.acceptanceText || ''} onChange={(e) => updateMag({ acceptanceText: e.target.value })} />
            </div>
          </div>
        </div>

        {/* ── RIGHT: LIVE PREVIEW (exact document, rendered in an iframe) ── */}
        <div className="sv-io-preview-wrap">
          <div className="sv-io-preview-doc">
            <iframe
              title="Confirmation Order preview"
              className="sv-io-preview-frame"
              srcDoc={genOrderHtml(docMag, orderData((form.orderId || '').trim() || '—'), true)}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="sv-btn-primary sv-io-download-btn" onClick={handleDownload} disabled={busyDl}>
              {busyDl ? 'Saving…' : 'Download PDF'}
            </button>
            <button type="button" className="sv-btn-primary sv-io-download-btn" style={{ background: '#16A34A' }} onClick={handleSaveToMemory} disabled={busyDl}>
              {busyDl ? 'Saving…' : '💾 Save to memory'}
            </button>
            <button type="button" className="sv-btn-primary sv-io-download-btn" style={{ background: '#334155' }} onClick={() => setShowSaved(true)}>
              Saved Insertion Orders ({savedOrders.length})
            </button>
            <button
              type="button"
              className="sv-btn-outline sv-io-download-btn"
              onClick={() => { if (window.confirm('Start a new blank order? The current draft will be cleared.')) { const dm = magazines.find((m) => m.id === currentId) || magazines[0] || {}; setForm({ ...BLANK_FORM, repName: dm.repName || '', repTitle: dm.repTitle || '', repEmail: dm.repEmail || '' }); setOrderSnap(null); setEditingKey(''); setAutoSaveState(''); } }}
            >
              New order
            </button>
            {editingKey && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, alignSelf: 'center',
                color: autoSaveState === 'error' ? '#DC2626' : autoSaveState === 'saving' ? '#B45309' : '#16A34A' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: autoSaveState === 'error' ? '#DC2626' : autoSaveState === 'saving' ? '#F59E0B' : '#16A34A' }} />
                {autoSaveState === 'error' ? 'Edit not saved — will retry' : autoSaveState === 'saving' ? 'Editing — auto-saving…' : 'Editing — all changes saved'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Saved Insertion Orders ── */}
      {showSaved && (
        <div className="sv-modal-overlay" onClick={() => setShowSaved(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="sv-modal" style={{ maxWidth: 720, width: '92%', maxHeight: '86vh', background: '#fff', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ fontWeight: 800, color: '#162B55', fontSize: 16 }}>Saved Insertion Orders</span>
              <button onClick={() => setShowSaved(false)} style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#64748B', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '8px 0' }}>
              {savedOrders.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748B', padding: '30px 16px', fontSize: 13.5 }}>No saved insertion orders yet. Download a Confirmation Order to save it here.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: '#F8FAFC', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '10px 16px' }}>Conf. No</th><th style={{ padding: '10px 16px' }}>Client</th><th style={{ padding: '10px 16px' }}>Date</th><th style={{ padding: '10px 16px' }}>Value</th><th style={{ padding: '10px 16px' }}>Document</th>
                  </tr></thead>
                  <tbody>
                    {[...savedOrders].sort((a, b) => String(b.paymentDate || b.createdAt || '').localeCompare(String(a.paymentDate || a.createdAt || ''))).map((e) => { const d = e.details || {}; return (
                      <tr key={e.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600 }}>{d.confirmationNo || e.contractOrder || '—'}</td>
                        <td style={{ padding: '10px 16px' }}>{e.clientName || '—'}</td>
                        <td style={{ padding: '10px 16px' }}>{e.paymentDate || '—'}</td>
                        <td style={{ padding: '10px 16px' }}>{e.amount != null ? `${e.amount} ${e.currency || ''}` : '—'}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
                            <button type="button" onClick={() => editSaved(e)} style={{ border: 'none', background: 'transparent', color: '#16A34A', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Edit</button>
                            <button type="button" onClick={() => reopenSaved(e)} style={{ border: 'none', background: 'transparent', color: '#2563EB', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Re-open</button>
                            {d.invoiceUrl && <a href={d.invoiceUrl} target="_blank" rel="noreferrer" style={{ color: '#64748B', fontWeight: 600 }}>File</a>}
                            <button type="button" onClick={() => deleteSaved(e)} style={{ border: 'none', background: 'transparent', color: '#DC2626', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Delete</button>
                          </span>
                        </td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
