import { useState, useEffect, useRef } from 'react';
import { Download, Save, FolderOpen, FilePlus } from 'lucide-react';
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
const LS_COUNTERS = 'svd_io_counters'; // per-magazine sequential order ID counters

const loadCounters = () => { try { const r = localStorage.getItem(LS_COUNTERS); if (r) return JSON.parse(r); } catch (e) {} return {}; };
const saveCounters = (c) => { try { localStorage.setItem(LS_COUNTERS, JSON.stringify(c)); } catch (e) {} };

// Derive a short uppercase prefix from the magazine name for the Order ID (e.g. "AWL", "CIO").
const getMagPrefix = (name, custom) => {
  if (custom && String(custom).trim()) return String(custom).trim().toUpperCase();
  const n = String(name || '').toUpperCase();
  if (n.includes('CIO')) return 'CIO';
  if (n.includes('AWL') || n.includes('ARAB')) return 'AWL';
  const w = n.split(/\s+/).filter(Boolean);
  return w[0] ? w[0].slice(0, 3) : 'ORD';
};

// Current Indian fiscal year as "YY-YY+1" (e.g. "26-27").
const getFiscalYear = () => {
  const d = new Date(); const y = d.getFullYear();
  const fy = d.getMonth() >= 3 ? y : y - 1;
  return `${String(fy).slice(2)}-${String(fy + 1).slice(2)}`;
};

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
    docTitle: 'INSERTION ORDER',
    acceptanceText: '',
    hClient: '', hPublisher: '', hAdvertising: '', hDeliverables: '',
    hCommercial: '', hPayment: '', hTerms: '', hAcceptance: '',
    payTerms: '100% advance payment',
    payMethod: 'Bank Transfer / Online Payment',
    bgColor: '',
    publisherAddress: '', publisherPhone: '',
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
    docTitle: 'INSERTION ORDER',
    acceptanceText: '',
    hClient: '', hPublisher: '', hAdvertising: '', hDeliverables: '',
    hCommercial: '', hPayment: '', hTerms: '', hAcceptance: '',
    payTerms: '100% advance payment',
    payMethod: 'Bank Transfer / Online Payment',
    bgColor: '',
    publisherAddress: '', publisherPhone: '',
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

/* Per-magazine compose drafts. LS_DRAFT holds a map { [magazineId]: form } so each
   magazine (Arab World Leaders, CIO Visionaries, and any future magazine) keeps its own
   in-progress order. A legacy single-form draft (old format) is migrated under __legacy. */
const loadDrafts = () => {
  try {
    const raw = localStorage.getItem(LS_DRAFT);
    if (!raw) return {};
    const o = JSON.parse(raw);
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      // Old format was a single form object — detect by its form-shaped keys.
      if ('clientName' in o || 'orderKey' in o || 'featureTitle' in o) return { __legacy: o };
      return o;
    }
  } catch (e) { /* ignore */ }
  return {};
};
const saveDrafts = (map) => { try { localStorage.setItem(LS_DRAFT, JSON.stringify(map)); } catch (e) { /* ignore */ } };

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
// IMPORTANT: never store the logo/watermark base64 in a saved order — those images are ~100-150KB
// each and bloat the record so the database write fails ("saved locally" error). We snapshot only
// lightweight fields; the branded logo/watermark are re-hydrated from the live magazine (matched by
// name) when the order is reopened/edited/printed. `publisherCompany` is the publisher org name.
const magSnap = (m) => ({
  id: m.id, name: m.name, publisherCompany: m.publisherCompany || "",
  publisherAddress: m.publisherAddress || "", publisherPhone: m.publisherPhone || "",
  repName: m.repName, repTitle: m.repTitle, repEmail: m.repEmail,
  approverName: m.approverName || '', approverTitle: m.approverTitle || '',
  orderPrefix: m.orderPrefix || '',
  accentColor: m.accentColor, headingColor: m.headingColor, bgColor: m.bgColor || '',
  stampScale: m.stampScale, logoText: m.logoText, logoSubText: m.logoSubText,
  logoScale: m.logoScale, watermarkOpacity: m.watermarkOpacity,
  watermarkSize: m.watermarkSize, docFontSize: m.docFontSize, perksHtml: m.perksHtml, termsHtml: m.termsHtml,
  website: m.website, footerEmail: m.footerEmail,
  docTitle: m.docTitle, acceptanceText: m.acceptanceText,
  hClient: m.hClient, hPublisher: m.hPublisher, hAdvertising: m.hAdvertising,
  hDeliverables: m.hDeliverables, hCommercial: m.hCommercial, hPayment: m.hPayment,
  hTerms: m.hTerms, hAcceptance: m.hAcceptance,
  payTerms: m.payTerms, payMethod: m.payMethod,
});

function genOrderHtml(m, data, preview = false) {
  m = m || {}; data = data || {};
  const D = (v, def) => (v == null || String(v).trim() === '' ? def : v);
  const accent = m.accentColor || '#C41E1E';
  const bg = '#ffffff';
  const cur = data.currency || 'USD';
  const num = (v) => { const n = Number(String(v).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };
  const money = (v) => `${num(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fee = num(data.cost);
  const hasCost = !(data.cost === '' || data.cost == null);
  const lScale = (Number(m.logoScale) || 100) / 100;
  const logoHtml = m.logoDataUrl
    ? `<img src="${m.logoDataUrl}" style="max-height:${Math.round(56 * lScale)}px;max-width:${Math.round(240 * lScale)}px;object-fit:contain;display:block;" alt="" />`
    : `<div style="display:inline-flex;align-items:baseline;gap:6px;"><span style="font-size:${Math.round(38 * lScale)}px;font-weight:800;color:${accent};line-height:1;letter-spacing:1px;">${esc(D(m.logoText, 'CIO'))}</span><span style="font-size:${Math.round(20 * lScale)}px;font-weight:700;letter-spacing:3px;color:#222;line-height:1;">${esc(D(m.logoSubText, 'VISIONARIES'))}</span></div>`;
  const docTitle = D(m.docTitle, 'INSERTION ORDER');
  const magName = D(m.name, 'CIO Visionaries Business Magazine');
  const footerSite = D(m.website, 'www.ciovisionaries.com');
  const hClient = D(m.hClient, 'ADVERTISER DETAILS');
  const hPublisher = D(m.hPublisher, 'PUBLISHER DETAILS');
  const hFeature = D(m.hAdvertising, 'FEATURE DETAILS');
  const hPackage = D(m.hCommercial, 'PARTICIPATION PACKAGE');
  const hDeliverables = D(m.hDeliverables, 'DELIVERABLES');
  const hSignOff = D(m.hAcceptance, 'SIGN OFF');
  const hTerms = D(m.hTerms, 'TERMS & CONDITIONS');
  const payTerms = D(data.paymentTerms, D(m.payTerms, '100% advance payment'));
  const payMethod = D(data.paymentMethod, D(m.payMethod, 'Bank Transfer / Online Payment'));
  const wmOpacity = m.watermarkOpacity != null && m.watermarkOpacity !== '' ? Number(m.watermarkOpacity) : 0.04;
  const wmSize = Math.max(30, Math.min(Number(m.watermarkSize) || 45, 60));
  const watermarkHtml = m.watermarkDataUrl
    ? `<div class="wm"><img src="${m.watermarkDataUrl}" style="width:${wmSize}%;max-width:55%;max-height:45%;opacity:${wmOpacity};" alt="" /></div>`
    : `<div class="wm"><div style="font-size:54px;font-weight:800;letter-spacing:6px;opacity:${wmOpacity};color:${accent};transform:rotate(-20deg);white-space:nowrap;user-select:none;">${esc(D(m.logoText, 'CIO'))} ${esc(D(m.logoSubText, 'VISIONARIES'))}</div></div>`;
  const fontSize = m.docFontSize ? `${m.docFontSize}pt` : '11.5pt';
  const stampMax = Math.round(80 * (Number(m.stampScale) || 100) / 100);
  const stampHtml = m.stampDataUrl
    ? `<div class="stamp-overlay"><img src="${m.stampDataUrl}" style="max-height:${stampMax}px;max-width:100%;object-fit:contain;" alt="" /></div>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=794, initial-scale=1" />
<title>${esc(docTitle)}</title>
<style>
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:'Times New Roman',Times,serif;color:#1a1a1a;font-size:${fontSize};line-height:1.3}
  .wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:0;pointer-events:none}
  .wm img{object-fit:contain}
  .doc{position:relative;width:100%;max-width:794px;min-height:1122px;margin:0 auto;padding:16px 32px 0;display:flex;flex-direction:column;background:#fff;overflow:hidden}
  @media screen{.doc{box-shadow:0 0 12px rgba(0,0,0,.08)}}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start}
  .hdr-meta{text-align:right}
  .hdr-meta .row{display:flex;justify-content:flex-end;align-items:baseline;gap:4px;margin-bottom:1px}
  .hdr-meta .lbl{color:#666;font-weight:600}
  .hdr-meta .val{min-width:130px;padding-left:4px;font-weight:600;color:#1a1a1a;min-height:14px}
  .title-block{text-align:center;margin:5px 0 2px}
  .title-block h1{font-size:16pt;font-weight:700;letter-spacing:2px;color:#1a1a1a;margin:0;line-height:1.1}
  .title-block .subtitle{font-size:9.5pt;color:#666;letter-spacing:.3px;margin-top:1px;font-weight:500}
  .accent-rule{height:1.5px;background:${accent};margin:5px 0 8px}
  .content{flex:1}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-bottom:8px}
  .sh{font-size:10pt;font-weight:700;text-transform:uppercase;color:${accent};letter-spacing:.8px;margin-bottom:3px}
  .field{margin-bottom:2px;display:flex;align-items:baseline;gap:4px}
  .field .label{color:#555;font-weight:700;min-width:105px;white-space:nowrap}
  .field .value{flex:1;color:#1a1a1a;min-height:13px}
  .section{margin-bottom:6px}
  .section .sh{border-bottom:1px solid #eee;padding-bottom:2px;margin-bottom:4px}
  .feat-row{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}
  .pkg-table{width:100%;border-collapse:collapse;margin-top:2px;border:2px solid ${accent}}
  .pkg-table th{background:#f9f9f9;border:1px solid #e0e0e0;padding:3px 8px;font-weight:700;color:#1a1a1a;text-align:left;text-transform:uppercase;letter-spacing:.3px}
  .pkg-table td{border:1px solid #e8e8e8;padding:3px 8px}
  .pkg-table th.amt,.pkg-table td.amt{text-align:right;width:38%}
  .pkg-table .total-row td{font-weight:700;border:2px solid ${accent};color:${accent};background:#fff8f8}
  .pay-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-top:4px;font-size:9.5pt;padding:2px 0}
  .pay-item{display:flex;gap:3px;align-items:baseline}
  .pay-item .pk{color:#666;font-weight:600}
  .pay-item .pv{color:#1a1a1a;font-weight:700}
  .sign-wrap{position:relative}
  .sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-top:4px}
  .sign-col{position:relative}
  .sign-label{font-size:9.5pt;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
  .sign-field{display:flex;align-items:baseline;gap:3px;margin-bottom:4px}
  .sign-field .sl{color:#555;font-weight:600;min-width:70px;white-space:nowrap}
  .sign-field .sv{flex:1;min-height:14px}
  .auto-sig{font-family:'Segoe Script','Brush Script MT','Dancing Script',cursive;font-size:14pt;color:#1a1a1a;font-weight:400;letter-spacing:.5px}
  .stamp-overlay{position:absolute;top:-5px;right:-5px;opacity:.85;pointer-events:none}
  .deliverables-block{line-height:1.3;color:#1a1a1a;font-size:${fontSize}}
  .deliverables-block ol,.deliverables-block ul{margin:1px 0;padding-left:16px}
  .deliverables-block li{margin-bottom:1px}
  .terms-block{font-size:7.5pt;color:#555;line-height:1.35}
  .terms-block ol,.terms-block ul{margin:1px 0;padding-left:14px}
  .terms-block li{margin-bottom:1px}
  .terms-block b,.terms-block strong{color:#333}
  .fwrap{margin-top:auto;padding:8px 0}
  .foot{text-align:center;margin:0;font-size:9pt;color:#555;font-weight:600;letter-spacing:.4px}
  .doc > *:not(.wm){position:relative;z-index:1}
  .hdr,.content,.two-col,.section,.sign-grid,.fwrap{break-inside:avoid;page-break-inside:avoid}
  @page{size:A4;margin:6mm}
  @media print{
    html,body{width:210mm;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .doc{width:198mm;max-width:198mm;min-height:284mm;margin:0;padding:16px 32px 0;display:flex;flex-direction:column;background:#fff;box-shadow:none}
    .fwrap{margin-top:auto;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .wm{position:fixed;inset:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style></head><body>
  <div class="doc">
    ${watermarkHtml}

    <div class="hdr">
      <div>${logoHtml}</div>
      <div class="hdr-meta">
        <div class="row"><span class="lbl">Order No.:</span><span class="val">${esc(D(data.orderId, ''))}</span></div>
        <div class="row"><span class="lbl">Date:</span><span class="val">${esc(D(data.date, ''))}</span></div>
      </div>
    </div>
    <div class="title-block">
      <h1>${esc(docTitle)}</h1>
      <div class="subtitle">${esc(magName)}</div>
    </div>
    <div class="accent-rule"></div>

    <div class="content">

      <div class="two-col">
        <div class="col">
          <div class="sh">${esc(hPublisher)}</div>
          <div class="field"><span class="label">Company</span><span class="value">${esc(D(m.publisherCompany, ''))}</span></div>
          <div class="field"><span class="label">Contact Person</span><span class="value">${esc(m.repName || '')}</span></div>
          <div class="field"><span class="label">Designation</span><span class="value">${esc(m.repTitle || '')}</span></div>
          <div class="field"><span class="label">Email</span><span class="value">${esc(m.repEmail || '')}</span></div>
        </div>
        <div class="col">
          <div class="sh">${esc(hClient)}</div>
          <div class="field"><span class="label">Company</span><span class="value">${esc(data.clientCompany || '')}</span></div>
          <div class="field"><span class="label">Contact Person</span><span class="value">${esc(data.clientName || '')}</span></div>
          <div class="field"><span class="label">Designation</span><span class="value">${esc(data.clientTitle || '')}</span></div>
          <div class="field"><span class="label">Email</span><span class="value">${esc(data.clientEmail || '')}</span></div>
        </div>
      </div>

      <div class="section">
        <div class="sh">${esc(hFeature)}</div>
        <div class="feat-row">
          <div class="field"><span class="label">Feature / Package</span><span class="value">${esc(data.featureTitle || '')}</span></div>
          <div class="field"><span class="label">Edition / Event</span><span class="value">${esc(data.edition || '')}</span></div>
        </div>
        <div class="field"><span class="label">Publication</span><span class="value">${esc(data.publication || '')}</span></div>
      </div>

      ${m.perksHtml ? `<div class="section">
        <div class="sh">${esc(hDeliverables)}</div>
        <div class="deliverables-block">${m.perksHtml}</div>
      </div>` : ''}

      <div class="section">
        <div class="sh">${esc(hPackage)}</div>
        <table class="pkg-table">
          <thead><tr><th>DESCRIPTION</th><th class="amt">AMOUNT (${esc(cur)})</th></tr></thead>
          <tbody>
            <tr><td>${esc(data.participationType || '')}</td><td class="amt">${hasCost ? money(fee) : ''}</td></tr>
            <tr><td>&nbsp;</td><td class="amt"></td></tr>
            <tr class="total-row"><td>NET AMOUNT PAYABLE</td><td class="amt">${hasCost ? `${esc(cur)} ${money(fee)}` : ''}</td></tr>
          </tbody>
        </table>
        <div class="pay-row">
          <div class="pay-item"><span class="pk">Payment Terms:</span><span class="pv">${esc(payTerms)}</span></div>
          <div class="pay-item"><span class="pk">Payment Method:</span><span class="pv">${esc(payMethod)}</span></div>
          <div class="pay-item"><span class="pk">Currency:</span><span class="pv">${esc(cur)}</span></div>
        </div>
      </div>

      <div class="section sign-wrap">
        <div class="sh">${esc(hSignOff)}</div>
        <div class="sign-grid">
          <div class="sign-col">
            <div class="sign-label">Agreed by (Advertiser)</div>
            <div class="sign-field"><span class="sl">Name:</span><span class="sv"></span></div>
            <div class="sign-field"><span class="sl">Title:</span><span class="sv"></span></div>
            <div class="sign-field"><span class="sl">Signature:</span><span class="sv"></span></div>
            <div class="sign-field"><span class="sl">Date:</span><span class="sv"></span></div>
          </div>
          <div class="sign-col">
            <div class="sign-label">Approved by (${esc(D(m.name, 'CIO Visionaries'))})</div>
            <div class="sign-field"><span class="sl">Name:</span><span class="sv">${esc(D(m.approverName, ''))}</span></div>
            <div class="sign-field"><span class="sl">Title:</span><span class="sv">${esc(D(m.approverTitle, ''))}</span></div>
            <div class="sign-field"><span class="sl">Signature:</span><span class="sv">${(m.approverName || '').trim() ? `<span class="auto-sig">${esc(m.approverName.trim())}</span>` : ''}</span></div>
            <div class="sign-field"><span class="sl">Date:</span><span class="sv">${esc(D(data.date, ''))}</span></div>
            ${stampHtml}
          </div>
        </div>
      </div>

      <div class="section" style="margin-bottom:0">
        <div class="sh">${esc(hTerms)}</div>
        <div class="terms-block">${m.termsHtml || '<ol><li>All rates are exclusive of applicable taxes.</li><li>Payment terms as specified, 100% advance prior to publication.</li><li>Cancellation within 7 days of publication date will incur full charges.</li><li>Content and materials must be submitted at least 14 days before publication.</li><li>Publisher reserves the right to reject material deemed inappropriate.</li></ol>'}</div>
      </div>

    </div>

    <div class="fwrap">
      <div class="foot">${esc(footerSite)}</div>
    </div>
  </div>
  ${preview ? '' : '<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},350);};</script>'}
</body></html>`;
}

// Merge a saved draft over the blank form — always apply today's date when the draft has none,
// and clear orderId so the auto-generate effect assigns the next sequential number.
// Old-format SV/... IDs (from the hash-based system) are cleared so the new sequential
// format (AWL26-27/101, CIO26-27/101, etc.) is generated on next load.
const mergeDraft = (blankForm, draft) => {
  if (!draft) return { ...blankForm };
  const merged = { ...blankForm, ...draft };
  if (!draft.date) merged.date = blankForm.date;
  if (!draft.orderId || /^SV\//.test(draft.orderId)) merged.orderId = '';
  return merged;
};

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
  const [newConfirm, setNewConfirm] = useState(false);
  const [busyDl, setBusyDl] = useState(false);
  const [busySave, setBusySave] = useState(false);
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
    clientCompany: '',
    clientName: '', clientTitle: '', clientEmail: '',
    participationType: '', publication: '',
    cost: '', currency: 'USD',
    paymentTerms: '', paymentMethod: '',
    repName: '', repTitle: '', repEmail: '',
  };
  // Restore THIS magazine's auto-saved draft so each magazine keeps its own previous order.
  const [form, setForm] = useState(() => {
    try {
      const drafts = loadDrafts();
      const mine = drafts[currentId] || drafts.__legacy;
      if (mine) return mergeDraft(BLANK_FORM, mine);
    } catch (e) { /* ignore */ }
    return { ...BLANK_FORM };
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

  // Auto-save the current order form as a per-magazine draft so each magazine's previous
  // order is retained. While editing a saved order we don't touch the compose drafts.
  useEffect(() => {
    if (editingKey || orderSnap) return;
    const map = loadDrafts();
    delete map.__legacy;
    map[currentId] = form;
    saveDrafts(map);
  }, [form, currentId, editingKey, orderSnap]);

  // Auto-populate the Order ID for new (unsaved) orders with the next sequential number.
  // Runs when the magazine changes or after a "Start New" clears the form.
  useEffect(() => {
    if (form.orderKey || form.orderId) return; // already has an ID — don't overwrite
    const hasCustom = !!(liveMag.orderPrefix && String(liveMag.orderPrefix).trim());
    const prefix = getMagPrefix(liveMag.name, liveMag.orderPrefix);
    const fullPrefix = hasCustom ? prefix : prefix + getFiscalYear();
    const counters = loadCounters();
    const next = (counters[fullPrefix] || 100) + 1;
    updateField('orderId', `${fullPrefix}/${next}`);
  }, [currentId, form.orderKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // Persist the current magazine's compose draft before creating + switching to a new one.
    if (!editingKey && !orderSnap) { const map = loadDrafts(); delete map.__legacy; map[currentId] = form; saveDrafts(map); }
    setMagazines((prev) => [
      ...prev,
      {
        id,
        name: 'New Magazine',
        // Branding starts fresh — admin fills in logo, colors, contact
        logoText: '', logoSubText: '', logoDataUrl: '',
        watermarkDataUrl: '', watermarkOpacity: 0.5, logoScale: 100, watermarkSize: 60,
        accentColor: '#1a1a1a', headingColor: '', bgColor: '',
        publisherCompany: '', publisherAddress: '', publisherPhone: '',
        repName: '', repTitle: '', repEmail: '',
        approverName: '', approverTitle: '', orderPrefix: '',
        stampDataUrl: '', stampScale: 100, docFontSize: '',
        website: '', footerEmail: '', docTitle: 'INSERTION ORDER', acceptanceText: '',
        // Section headings inherit from current magazine so the document topology is identical
        hClient: liveMag.hClient || '', hPublisher: liveMag.hPublisher || '',
        hAdvertising: liveMag.hAdvertising || '', hDeliverables: liveMag.hDeliverables || '',
        hCommercial: liveMag.hCommercial || '', hPayment: liveMag.hPayment || '',
        hTerms: liveMag.hTerms || '', hAcceptance: liveMag.hAcceptance || '',
        payTerms: liveMag.payTerms || '100% advance payment',
        payMethod: liveMag.payMethod || 'Bank Transfer / Online Payment',
        // Copy deliverables and terms so the new magazine has the same content structure
        perksHtml: liveMag.perksHtml || '', termsHtml: liveMag.termsHtml || '',
      },
    ]);
    setCurrentId(id); setOrderSnap(null); setEditingKey(''); setAutoSaveState('');
    setForm({ ...BLANK_FORM }); // fresh order for the new magazine
  };

  const deleteMagazine = () => {
    if (magazines.length <= 1) {
      window.alert('At least one magazine template must exist.');
      return;
    }
    if (!window.confirm(`Delete magazine "${mag.name}"? This cannot be undone.`)) return;
    // Drop this magazine's compose draft too, then switch to the first remaining magazine.
    const map = loadDrafts(); delete map[currentId]; saveDrafts(map);
    const remaining = magazines.filter((m) => m.id !== currentId);
    const nextId = remaining[0].id;
    setMagazines(remaining);
    setCurrentId(nextId); setOrderSnap(null); setEditingKey(''); setAutoSaveState('');
    const saved = loadDrafts()[nextId];
    setForm(mergeDraft(BLANK_FORM, saved));
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

  // Re-attach the live magazine's logo/watermark images (not stored on the saved order) to a
  // lightweight snapshot, matched by magazine name — so the branded document reproduces exactly.
  const hydrateSnap = (snap, magName) => {
    if (!snap) return null;
    const live = magazines.find((x) => x.name === magName) || {};
    return { ...snap, logoDataUrl: live.logoDataUrl || '', watermarkDataUrl: live.watermarkDataUrl || '', stampDataUrl: live.stampDataUrl || '' };
  };

  // Re-open (regenerate) a saved insertion order from its stored data.
  const reopenSaved = (rec) => {
    const dd = rec.details || {};
    // Prefer the frozen snapshot (re-hydrated with the live logo); fall back to matching magazine.
    const m = hydrateSnap(dd.magSnapshot, dd.magazine) || magazines.find((x) => x.name === dd.magazine) || mag;
    const html = genOrderHtml(m, {
      orderId: dd.orderId || dd.confirmationNo || '',
      date: rec.paymentDate || (() => { if (!dd.generatedAt) return ''; const p = String(dd.generatedAt).slice(0,10).split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ''; })(),
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
      date: rec.paymentDate || (dd.generatedAt ? (() => { const p = String(dd.generatedAt).slice(0,10).split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ''; })() : todayStr()),
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
    setOrderSnap(hydrateSnap(dd.magSnapshot, dd.magazine));
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
      setBusySave(true);
      const safe = `confirmation-order-${confNo.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.html`;
      const path = `insertion-orders/${safe}`;
      const { error } = await supabase.storage.from('design-files').upload(path, new Blob([html], { type: 'text/html' }), { upsert: false });
      if (!error) { fileUrl = supabase.storage.from('design-files').getPublicUrl(path).data.publicUrl; fileName = `Confirmation Order ${confNo}.html`; }
    } catch (e) { /* upload optional — record still captured */ }
    finally { setBusySave(false); }
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
    // Advance the per-magazine counter so the NEXT new order gets a higher sequential number.
    const _hasCustom = !!(mag.orderPrefix && String(mag.orderPrefix).trim());
    const _pfx = getMagPrefix(mag.name, mag.orderPrefix);
    const _fullPfx = _hasCustom ? _pfx : _pfx + getFiscalYear();
    const _num = parseInt(String(form.orderId || confNo).replace(/.*\//, ''), 10);
    if (_num && !isNaN(_num)) { const _c = loadCounters(); _c[_fullPfx] = Math.max(_c[_fullPfx] || 0, _num); saveCounters(_c); }
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
    setBusyDl(true);
    const order = buildOrder();
    const w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(order.html); w.document.close(); }
    setBusyDl(false);
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
              // Persist the current magazine's compose draft before switching away.
              if (!editingKey && !orderSnap) {
                const map = loadDrafts(); delete map.__legacy; map[currentId] = form; saveDrafts(map);
              }
              setCurrentId(id); setOrderSnap(null); setEditingKey(''); setAutoSaveState('');
              // Restore the target magazine's saved draft if it has one, else start a fresh order.
              // Publisher Information comes from the magazine template (single source), not the order.
              const saved = loadDrafts()[id];
              setForm(mergeDraft(BLANK_FORM, saved));
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

            {/* Client Information */}
            <div className="sv-iof-group">
              <div className="sv-iof-gh">Client Information</div>
              <div className="sv-io-row-2">
                <div className="sv-io-field">
                  <label className="sv-form-label">Client company</label>
                  <input className="sv-input" type="text" placeholder="e.g. Riskmindz" value={form.clientCompany} onChange={(e) => updateField('clientCompany', e.target.value)} />
                </div>
                <div className="sv-io-field">
                  <label className="sv-form-label">Client name</label>
                  <input className="sv-input" type="text" placeholder="e.g. Sachin Singh" value={form.clientName} onChange={(e) => updateField('clientName', e.target.value)} />
                </div>
              </div>
              <div className="sv-io-row-2">
                <div className="sv-io-field">
                  <label className="sv-form-label">Client title</label>
                  <input className="sv-input" type="text" placeholder="e.g. Founder" value={form.clientTitle} onChange={(e) => updateField('clientTitle', e.target.value)} />
                </div>
                <div className="sv-io-field">
                  <label className="sv-form-label">Client email</label>
                  <input className="sv-input" type="email" placeholder="e.g. sachin@riskmindz.com" value={form.clientEmail} onChange={(e) => updateField('clientEmail', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Publisher Information — edits the selected magazine template (single source) */}
            <div className="sv-iof-group">
              <div className="sv-iof-gh">Publisher Information <span style={{ color: '#94A3B8', fontWeight: 500, fontSize: 11 }}>(saved to {liveMag.name || 'this magazine'})</span></div>
              <div className="sv-io-field">
                <label className="sv-form-label">Contact person</label>
                <input className="sv-input" type="text" placeholder="e.g. Ryan Scott" value={liveMag.repName || ''} onChange={(e) => updateMag({ repName: e.target.value })} />
              </div>
              <div className="sv-io-row-2">
                <div className="sv-io-field">
                  <label className="sv-form-label">Designation</label>
                  <input className="sv-input" type="text" placeholder="e.g. Market Research Analyst" value={liveMag.repTitle || ''} onChange={(e) => updateMag({ repTitle: e.target.value })} />
                </div>
                <div className="sv-io-field">
                  <label className="sv-form-label">Email</label>
                  <input className="sv-input" type="email" placeholder="e.g. ryan@ciovisionaries.com" value={liveMag.repEmail || ''} onChange={(e) => updateMag({ repEmail: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Approver / Manager — fills the "Approved by" column on the document */}
            <div className="sv-iof-group">
              <div className="sv-iof-gh">Approved By (Manager) <span style={{ color: '#94A3B8', fontWeight: 500, fontSize: 11 }}>(auto-fills sign-off + digital signature)</span></div>
              <div className="sv-io-row-2">
                <div className="sv-io-field">
                  <label className="sv-form-label">Manager name</label>
                  <input className="sv-input" type="text" placeholder="e.g. Faraz Khan" value={liveMag.approverName || ''} onChange={(e) => updateMag({ approverName: e.target.value })} />
                </div>
                <div className="sv-io-field">
                  <label className="sv-form-label">Title / Designation</label>
                  <input className="sv-input" type="text" placeholder="e.g. Business Development Manager" value={liveMag.approverTitle || ''} onChange={(e) => updateMag({ approverTitle: e.target.value })} />
                </div>
              </div>
              {liveMag.approverName && (
                <div style={{ marginTop: 6, padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Signature preview:</span>
                  <div style={{ fontFamily: "'Segoe Script','Brush Script MT',cursive", fontSize: 20, color: '#1a1a1a', marginTop: 2 }}>{liveMag.approverName}</div>
                </div>
              )}
            </div>

            {/* Order Information */}
            <div className="sv-iof-group">
              <div className="sv-iof-gh">Order Information</div>
              <div className="sv-io-row-2">
                <div className="sv-io-field">
                  <label className="sv-form-label">Date</label>
                  <div className="sv-flex sv-gap-2" style={{ alignItems: 'center' }}>
                    <input className="sv-input" type="text" readOnly value={form.date} style={{ flex: 1, cursor: 'default' }} />
                    <input
                      type="date"
                      style={{ width: 36, height: 36, padding: 2, border: '1px solid #E2E8F0', borderRadius: 6, cursor: 'pointer', background: '#F8FAFC' }}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const [y, mo, d] = e.target.value.split('-');
                        updateField('date', `${d}/${mo}/${y}`);
                      }}
                    />
                  </div>
                </div>
                <div className="sv-io-field">
                  <label className="sv-form-label">Order ID</label>
                  {(() => {
                    const _hc = !!(liveMag.orderPrefix && String(liveMag.orderPrefix).trim());
                    const _pfx = getMagPrefix(liveMag.name, liveMag.orderPrefix);
                    const currentPrefix = _hc ? _pfx : _pfx + getFiscalYear();
                    const numStr = String(form.orderId || '').replace(/.*\//, '');
                    const numVal = parseInt(numStr, 10) || 101;
                    return (
                      <div className="sv-flex sv-gap-2" style={{ alignItems: 'center' }}>
                        <input className="sv-input" type="text"
                          style={{ width: 100, fontWeight: 700, fontSize: 13 }}
                          placeholder={getMagPrefix(liveMag.name) + getFiscalYear()}
                          value={liveMag.orderPrefix || ''}
                          onChange={(e) => updateMag({ orderPrefix: e.target.value })}
                        />
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#334155' }}>/</span>
                        <input className="sv-input" type="number" min="1" style={{ width: 68, textAlign: 'center', fontWeight: 700 }}
                          value={numVal}
                          onChange={(e) => updateField('orderId', currentPrefix + '/' + (e.target.value || '1'))}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <button type="button" onClick={() => updateField('orderId', currentPrefix + '/' + (numVal + 1))}
                            style={{ border: '1px solid #E2E8F0', background: '#F8FAFC', borderRadius: '4px 4px 0 0', cursor: 'pointer', padding: '0 6px', fontSize: 11, lineHeight: '16px', fontWeight: 700, color: '#475569' }}>▲</button>
                          <button type="button" onClick={() => updateField('orderId', currentPrefix + '/' + Math.max(1, numVal - 1))}
                            style={{ border: '1px solid #E2E8F0', background: '#F8FAFC', borderRadius: '0 0 4px 4px', cursor: 'pointer', padding: '0 6px', fontSize: 11, lineHeight: '16px', fontWeight: 700, color: '#475569' }}>▼</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="sv-io-row-2">
                <div className="sv-io-field">
                  <label className="sv-form-label">Edition</label>
                  <input className="sv-input" type="text" placeholder="e.g. September 2026" value={form.edition} onChange={(e) => updateField('edition', e.target.value)} />
                </div>
                <div className="sv-io-field">
                  <label className="sv-form-label">Participation cost</label>
                  <div className="sv-flex sv-gap-2">
                    <input className="sv-input" type="text" placeholder="199" value={form.cost} onChange={(e) => updateField('cost', e.target.value)} style={{ flex: 2 }} />
                    <input className="sv-input" list="io-cur-list" value={form.currency} onChange={(e) => updateField('currency', e.target.value.toUpperCase())} placeholder="USD" style={{ flex: 1, minWidth: 84 }} />
                    <datalist id="io-cur-list">{IO_CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Details */}
            <div className="sv-iof-group">
              <div className="sv-iof-gh">Feature Details</div>
              <div className="sv-io-field">
                <label className="sv-form-label">Feature / Package</label>
                <input className="sv-input" type="text" placeholder='"The 10 Most Influential ... in 2025."' value={form.featureTitle} onChange={(e) => updateField('featureTitle', e.target.value)} />
              </div>
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
            </div>

            {/* Payment Details */}
            <div className="sv-iof-group">
              <div className="sv-iof-gh">Payment Details <span style={{ color: '#94A3B8', fontWeight: 500, fontSize: 11 }}>(blank = magazine default)</span></div>
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

            <p className="sv-text-muted" style={{ fontSize: 11.5, margin: '2px 2px 0' }}>
              Publisher Information (contact person, designation, email) is set once per magazine in the <b>Magazine template</b> section below.
            </p>
          </div>

          {/* Magazine template — dynamic brand configuration */}
          <div className="sv-card sv-io-form-card">
            <h3 className="sv-io-section-title" style={{ marginBottom: 14 }}>Magazine template</h3>

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

            {/* Digital stamp — shows in the Client Acceptance area when set; blank space otherwise */}
            <div className="sv-io-field">
              <label className="sv-form-label">Digital stamp <span style={{ color: '#94A3B8', fontWeight: 500 }}>(optional — appears in Client Acceptance)</span></label>
              <div className="sv-io-upload-row">
                <label className="sv-btn-outline sv-io-upload-btn">
                  Upload stamp
                  <input type="file" accept="image/*" hidden onChange={(e) => onImageUpload(e, 'stampDataUrl')} />
                </label>
                {mag.stampDataUrl && (
                  <>
                    <img className="sv-io-thumb" src={mag.stampDataUrl} alt="stamp preview" />
                    <button
                      type="button"
                      className="sv-io-perk-remove"
                      onClick={() => { if (window.confirm('Remove this digital stamp?')) updateMag({ stampDataUrl: '' }); }}
                      aria-label="Remove stamp"
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
              {mag.stampDataUrl && (
                <div style={{ marginTop: 8 }}>
                  <label className="sv-form-label">Stamp size — {mag.stampScale || 100}%</label>
                  <div className="sv-flex sv-gap-2" style={{ alignItems: 'center' }}>
                    <button type="button" className="sv-btn-outline" style={{ padding: '2px 10px', fontWeight: 700 }} onClick={() => updateMag({ stampScale: Math.max(40, (Number(mag.stampScale) || 100) - 10) })} aria-label="Zoom out">−</button>
                    <input type="range" min="40" max="220" step="5" value={mag.stampScale || 100} onChange={(e) => updateMag({ stampScale: Number(e.target.value) })} style={{ flex: 1 }} />
                    <button type="button" className="sv-btn-outline" style={{ padding: '2px 10px', fontWeight: 700 }} onClick={() => updateMag({ stampScale: Math.min(220, (Number(mag.stampScale) || 100) + 10) })} aria-label="Zoom in">+</button>
                  </div>
                </div>
              )}
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
              <label className="sv-form-label">Publisher company <span style={{ color: '#94A3B8', fontWeight: 500 }}>(shown on the order; defaults to the magazine name)</span></label>
              <input
                className="sv-input"
                type="text"
                placeholder={liveMag.name || 'e.g. Arab World Leaders'}
                value={liveMag.publisherCompany || ''}
                onChange={(e) => updateMag({ publisherCompany: e.target.value })}
              />
            </div>
            <p className="sv-text-muted" style={{ fontSize: 11.5, margin: '-2px 0 10px' }}>
              Contact person, designation and email are edited in the <b>Publisher Information</b> group at the top of the form.
            </p>
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
            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Document title</label>
                <input className="sv-input" type="text" placeholder="INSERTION ORDER" value={liveMag.docTitle || ''} onChange={(e) => updateMag({ docTitle: e.target.value })} />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Font size (pt)</label>
                <input className="sv-input" type="number" min="8" max="16" step="0.5" placeholder="11.5" value={liveMag.docFontSize || ''} onChange={(e) => updateMag({ docFontSize: e.target.value })} />
              </div>
            </div>
            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Advertiser Details</label>
                <input className="sv-input" type="text" placeholder="ADVERTISER DETAILS" value={liveMag.hClient || ''} onChange={(e) => updateMag({ hClient: e.target.value })} />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Publisher Details</label>
                <input className="sv-input" type="text" placeholder="PUBLISHER DETAILS" value={liveMag.hPublisher || ''} onChange={(e) => updateMag({ hPublisher: e.target.value })} />
              </div>
            </div>
            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Feature Details</label>
                <input className="sv-input" type="text" placeholder="FEATURE DETAILS" value={liveMag.hAdvertising || ''} onChange={(e) => updateMag({ hAdvertising: e.target.value })} />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Participation Package</label>
                <input className="sv-input" type="text" placeholder="PARTICIPATION PACKAGE" value={liveMag.hCommercial || ''} onChange={(e) => updateMag({ hCommercial: e.target.value })} />
              </div>
            </div>
            <div className="sv-io-row-2">
              <div className="sv-io-field">
                <label className="sv-form-label">Terms &amp; Conditions</label>
                <input className="sv-input" type="text" placeholder="TERMS & CONDITIONS" value={liveMag.hTerms || ''} onChange={(e) => updateMag({ hTerms: e.target.value })} />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Sign Off</label>
                <input className="sv-input" type="text" placeholder="SIGN OFF" value={liveMag.hAcceptance || ''} onChange={(e) => updateMag({ hAcceptance: e.target.value })} />
              </div>
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

          <div className="sv-io-actgrid">
            <button type="button" className="sv-io-actbtn sv-io-actbtn--blue" onClick={handleDownload} disabled={busyDl}>
              <Download size={16} /> {busyDl ? 'Opening…' : 'Download PDF'}
            </button>
            <button type="button" className="sv-io-actbtn sv-io-actbtn--green" onClick={handleSaveToMemory} disabled={busySave}>
              <Save size={16} /> {busySave ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="sv-io-actbtn sv-io-actbtn--slate" onClick={() => setShowSaved(true)}>
              <FolderOpen size={16} /> Saved Files <span className="sv-io-actbadge">({savedOrders.length})</span>
            </button>
            <button type="button" className="sv-io-actbtn sv-io-actbtn--ghost" onClick={() => setNewConfirm(true)}>
              <FilePlus size={16} /> New
            </button>
          </div>
          {editingKey && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, marginTop: 8,
              color: autoSaveState === 'error' ? '#DC2626' : autoSaveState === 'saving' ? '#B45309' : '#16A34A' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: autoSaveState === 'error' ? '#DC2626' : autoSaveState === 'saving' ? '#F59E0B' : '#16A34A' }} />
              {autoSaveState === 'error' ? 'Edit not saved — will retry' : autoSaveState === 'saving' ? 'Editing — auto-saving…' : 'Editing — all changes saved'}
            </span>
          )}
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
                            {d.invoiceUrl && <a href={d.invoiceUrl} target="_blank" rel="noreferrer" style={{ color: '#64748B', fontWeight: 600 }}>Show</a>}
                            <button type="button" className="sv-btn sv-btn--danger sv-btn--sm" onClick={() => deleteSaved(e)}>Delete</button>
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

      {/* New Insertion Order — confirmation before clearing the current draft */}
      {newConfirm && (
        <div className="sv-modal-overlay" onClick={() => setNewConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div className="sv-modal" style={{ maxWidth: 420, width: '92%', background: '#fff', borderRadius: 14, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '18px 20px 14px' }}>
              <div style={{ fontWeight: 800, color: '#162B55', fontSize: 16, marginBottom: 6 }}>Start a New Insertion Order?</div>
              <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                This will remove the current draft data and start a new client entry. Your magazine, domain, and other template settings will remain unchanged.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '0 20px 18px', justifyContent: 'flex-end' }}>
              <button type="button" className="sv-io-actbtn sv-io-actbtn--ghost" style={{ height: 40, padding: '0 16px' }} onClick={() => setNewConfirm(false)}>Cancel</button>
              <button type="button" className="sv-io-actbtn sv-io-actbtn--blue" style={{ height: 40, padding: '0 16px' }} onClick={() => {
                // Clear only the client/order draft; keep the selected magazine, domain, logo, watermark,
                // template settings and all saved insertion orders untouched.
                setForm({ ...BLANK_FORM });
                setOrderSnap(null);
                setEditingKey('');
                setAutoSaveState('');
                setNewConfirm(false);
              }}>Yes, Start New</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
