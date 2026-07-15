import { useState, useEffect, useRef } from 'react';

/* ============================================================
   INSERTION ORDER — fully dynamic, multi-magazine templates.
   Every magazine keeps its own logo, watermark, accent color,
   company/contact info, perks and terms. Everything auto-saves
   to localStorage (key: svd_io_magazines) and reloads next time.
   Add unlimited magazines from the UI — no code changes needed.
   ============================================================ */

const LS_MAGS = 'svd_io_magazines';
const LS_CURRENT = 'svd_io_current';

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

const loadMagazines = () => {
  try {
    const raw = localStorage.getItem(LS_MAGS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr;
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

export default function InsertionOrderForm({ onCapture } = {}) {
  const [magazines, setMagazines] = useState(loadMagazines);
  const [currentId, setCurrentId] = useState(() => {
    try {
      const c = localStorage.getItem(LS_CURRENT);
      if (c) return c;
    } catch (e) {
      /* ignore */
    }
    return 'cioVisionaries';
  });

  const mag = magazines.find((m) => m.id === currentId) || magazines[0];

  const [form, setForm] = useState({
    date: todayStr(),
    featureTitle: '',
    clientCompany: '',
    clientName: '',
    clientTitle: '',
    clientEmail: '',
    cost: '199',
  });

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

  /* ── Print-based PDF: mirrors the live preview exactly ── */
  const handleDownload = () => {
    const logoHtml = mag.logoDataUrl
      ? `<img src="${mag.logoDataUrl}" style="max-height:${64 * logoScale}px;max-width:${240 * logoScale}px;object-fit:contain;" alt="" />`
      : mag.logoText || mag.logoSubText
      ? `<span style="font-size:${34 * logoScale}px;font-weight:800;font-family:Georgia,serif;color:${accent};">${esc(
          mag.logoText
        )}</span><span style="font-size:${16 * logoScale}px;font-weight:600;letter-spacing:1px;margin-left:4px;">${esc(
          mag.logoSubText
        )}</span>`
      : `<span style="font-size:${34 * logoScale}px;font-weight:800;font-family:Georgia,serif;color:${accent};">${esc(
          mag.name
        )}</span>`;

    const watermarkHtml = mag.watermarkDataUrl
      ? `<img src="${mag.watermarkDataUrl}" alt="" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);max-width:${wmSize}%;max-height:${wmSize}%;opacity:${mag.watermarkOpacity};z-index:0;pointer-events:none;" />`
      : '';

    const html = `<!doctype html><html><head><meta charset="utf-8" />
<title>Confirmation Order</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', Georgia, serif; color: #1a1a1a; }
  .doc { position: relative; max-width: 720px; margin: 0 auto; padding: 40px 34px; overflow: hidden; }
  .content { position: relative; z-index: 1; }
  .hdr { text-align: center; }
  .divider { height: 3px; width: 60px; margin: 6px 0 14px; background: ${accent}; }
  .title { text-align: center; font-size: 16px; font-weight: 700; letter-spacing: .5px; margin-bottom: 4px; }
  .date { text-align: right; font-size: 12.5px; font-weight: 700; margin-bottom: 14px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .box { border: 1px solid #333; padding: 8px 10px; font-size: 12px; line-height: 1.6; }
  .box .nm { font-weight: 700; margin-bottom: 2px; }
  .box .em { text-decoration: underline; color: #1a4fba; }
  h4 { font-size: 13px; font-weight: 700; text-decoration: underline; margin: 16px 0 8px; }
  .body { font-size: 12.5px; line-height: 1.6; }
  .rich { font-size: 12.5px; line-height: 1.7; }
  .rich ul, .rich ol { padding-left: 20px; margin: 6px 0; }
  .signoff { margin-top: 18px; font-size: 12.5px; }
  .signoff .row { display: flex; justify-content: space-between; margin-top: 10px; }
  .terms { font-size: 11px; line-height: 1.6; color: #333; }
  .terms ol, .terms ul { padding-left: 18px; margin: 6px 0; }
  @page { margin: 12mm; }
</style></head>
<body>
  <div class="doc">
    ${watermarkHtml}
    <div class="content">
      <div class="hdr">${logoHtml}</div>
      <div class="divider"></div>
      <div class="title">CONFIRMATION ORDER</div>
      <div class="date">Date &ndash; ${esc(form.date || '—')}</div>
      <div class="parties">
        <div class="box">
          <div class="nm">${esc(mag.name)}</div>
          <div>${esc(mag.repName)}</div>
          <div>${esc(mag.repTitle)}</div>
          <div class="em">${esc(mag.repEmail)}</div>
        </div>
        <div class="box">
          <div class="nm">${esc(form.clientCompany || '[Client Company]')}</div>
          <div>${esc(form.clientName || '[Client Name]')}</div>
          <div>${esc(form.clientTitle || '[Title]')}</div>
          <div class="em">${esc(form.clientEmail || '[email]')}</div>
        </div>
      </div>
      <h4>Advertising details: -</h4>
      <div class="body"><strong>Feature Title</strong> &ndash; "${esc(form.featureTitle || '...')}"</div>
      <div class="body" style="margin-top:10px;"><strong>Perk with this Exclusive feature:</strong></div>
      <div class="rich">${mag.perksHtml || ''}</div>
      <div class="body" style="margin-top:10px;"><strong>Participation Cost:</strong> $ ${esc(
        form.cost || '0'
      )} USD.</div>
      <div class="signoff">
        <strong>Agreed By:</strong>
        <div class="row"><span>Name: ____________________</span><span>Title: ____________________</span></div>
        <div class="row"><span>Signature: ________________</span><span>Date: ____________________</span></div>
      </div>
      <h4>Terms &amp; Conditions:</h4>
      <div class="rich terms">${mag.termsHtml || ''}</div>
    </div>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.focus();window.print();},350);};</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    if (typeof onCapture === 'function') {
      const dt = new Date(form.date || Date.now());
      const fyStart = dt.getMonth() >= 3 ? dt.getFullYear() : dt.getFullYear() - 1;
      const fy = `${String(fyStart).slice(2)}-${String(fyStart + 1).slice(2)}`;
      const src = `io:${(form.clientName || '').trim()}:${form.date || ''}:${mag.name || ''}`;
      let hash = 0; for (let i = 0; i < src.length; i++) hash = (hash * 31 + src.charCodeAt(i)) & 0xffff;
      const confNo = `SV/${fy}/${String((hash % 900) + 100)}`;
      onCapture({
        type: 'insertion_order',
        sourceKey: src,
        title: form.featureTitle || form.clientName || 'Insertion Order',
        category: 'Insertion Order',
        clientName: form.clientName || '',
        contractOrder: confNo,
        paymentStatus: 'Pending',
        paymentDate: form.date || '',
        amount: form.cost === '' ? null : Number(form.cost),
        currency: 'USD',
        details: {
          confirmationNo: confNo,
          contractNo: confNo,
          clientName: form.clientName || '',
          companyName: form.clientCompany || '',
          clientTitle: form.clientTitle || '',
          clientEmail: form.clientEmail || '',
          featureTitle: form.featureTitle || '',
          magazine: mag.name || '',
          generatedAt: new Date().toISOString(),
          contractValue: form.cost || '',
          currency: 'USD',
          orderStatus: 'Downloaded',
          paymentStatus: 'Pending',
        },
      });
    }
  };

  return (
    <div className="sv-io-wrap">
      {/* ── Magazine selector + Add ── */}
      <div className="sv-io-brand-row">
        <label className="sv-form-label">Select Magazine</label>
        <div className="sv-io-brand-controls">
          <select
            className="sv-input"
            value={mag.id}
            onChange={(e) => setCurrentId(e.target.value)}
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

            <div className="sv-io-field">
              <label className="sv-form-label">Participation cost (USD)</label>
              <input
                className="sv-input"
                type="text"
                placeholder="199"
                value={form.cost}
                onChange={(e) => updateField('cost', e.target.value)}
              />
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
                value={mag.name}
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
                  value={mag.logoText}
                  onChange={(e) => updateMag({ logoText: e.target.value })}
                />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Header text — subtitle</label>
                <input
                  className="sv-input"
                  type="text"
                  placeholder="VISIONARIES"
                  value={mag.logoSubText}
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
                      onClick={() => updateMag({ logoDataUrl: '' })}
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
                      onClick={() => updateMag({ watermarkDataUrl: '' })}
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
                  value={mag.watermarkOpacity}
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
                    value={mag.accentColor}
                    onChange={(e) => updateMag({ accentColor: e.target.value })}
                  />
                  <input
                    className="sv-input"
                    type="text"
                    value={mag.accentColor}
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
                  value={mag.logoScale || 100}
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
                  value={mag.watermarkSize || 60}
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
                value={mag.repName}
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
                  value={mag.repTitle}
                  onChange={(e) => updateMag({ repTitle: e.target.value })}
                />
              </div>
              <div className="sv-io-field">
                <label className="sv-form-label">Email</label>
                <input
                  className="sv-input"
                  type="email"
                  placeholder="ryan@ciovisionaries.com"
                  value={mag.repEmail}
                  onChange={(e) => updateMag({ repEmail: e.target.value })}
                />
              </div>
            </div>

            {/* Perks — rich text */}
            <div className="sv-io-field">
              <label className="sv-form-label">Perks with this exclusive feature</label>
              <RichTextEditor
                key={`perks-${mag.id}`}
                initialHtml={mag.perksHtml}
                placeholder="Add perks — use bullets or numbering…"
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
          </div>
        </div>

        {/* ── RIGHT: LIVE PREVIEW ── */}
        <div className="sv-io-preview-wrap">
          <div className="sv-io-preview">
            {mag.watermarkDataUrl && (
              <img
                className="sv-io-watermark"
                src={mag.watermarkDataUrl}
                style={{ opacity: mag.watermarkOpacity, maxWidth: `${wmSize}%`, maxHeight: `${wmSize}%` }}
                alt=""
              />
            )}
            <div className="sv-io-preview-content">
              <div className="sv-io-preview-header">{renderLogo()}</div>
              <div className="sv-io-preview-divider" style={{ background: accent }} />

              <h2 className="sv-io-preview-title">CONFIRMATION ORDER</h2>
              <p className="sv-io-preview-date">Date – {form.date || '—'}</p>

              <div className="sv-io-preview-parties">
                <div className="sv-io-party-box">
                  <div className="sv-io-party-name">{mag.name}</div>
                  <div>{mag.repName}</div>
                  <div>{mag.repTitle}</div>
                  <div className="sv-io-party-email">{mag.repEmail}</div>
                </div>
                <div className="sv-io-party-box">
                  <div className="sv-io-party-name">{form.clientCompany || '[Client Company]'}</div>
                  <div>{form.clientName || '[Client Name]'}</div>
                  <div>{form.clientTitle || '[Title]'}</div>
                  <div className="sv-io-party-email">{form.clientEmail || '[email]'}</div>
                </div>
              </div>

              <h4 className="sv-io-preview-h4">Advertising details: -</h4>
              <p className="sv-io-preview-body">
                <strong>Feature Title</strong> – "{form.featureTitle || '...'}"
              </p>

              <p className="sv-io-preview-body" style={{ marginTop: 10 }}>
                <strong>Perk with this Exclusive feature:</strong>
              </p>
              <div
                className="sv-io-preview-rich"
                dangerouslySetInnerHTML={{ __html: mag.perksHtml || '' }}
              />

              <p className="sv-io-preview-body" style={{ marginTop: 10 }}>
                <strong>Participation Cost:</strong> $ {form.cost || '0'} USD.
              </p>

              <div className="sv-io-preview-signoff">
                <strong>Agreed By:</strong>
                <div className="sv-io-signoff-row">
                  <span>Name: ____________________</span>
                  <span>Title: ____________________</span>
                </div>
                <div className="sv-io-signoff-row">
                  <span>Signature: ________________</span>
                  <span>Date: ____________________</span>
                </div>
              </div>

              <h4 className="sv-io-preview-h4">Terms &amp; Conditions:</h4>
              <div
                className="sv-io-preview-rich sv-io-preview-terms"
                dangerouslySetInnerHTML={{ __html: mag.termsHtml || '' }}
              />
            </div>
          </div>

          <button type="button" className="sv-btn-primary sv-io-download-btn" onClick={handleDownload}>
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
