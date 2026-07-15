import { useState } from 'react';

/* ============================================================
   INSERTION ORDER — Brand config
   Add new brands here later — everything else stays the same.
   ============================================================ */
const BRANDS = {
  cioVisionaries: {
    id: 'cioVisionaries',
    name: 'CIO Visionaries',
    logoText: 'CIO',
    logoSubText: 'VISIONARIES',
    accentColor: '#D32F2F',
    repName: 'Ryan Scott',
    repTitle: 'Manager - Market Research',
    repEmail: 'ryan@ciovisionaries.com',
  },
  // riskMindzPartner: { id:'riskMindzPartner', name:'Another Brand', ... }
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

const todayStr = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export default function InsertionOrderForm() {
  const [brandId, setBrandId] = useState('cioVisionaries');
  const brand = BRANDS[brandId];

  const [form, setForm] = useState({
    date: todayStr(),
    featureTitle: '',
    clientCompany: '',
    clientName: '',
    clientTitle: '',
    clientEmail: '',
    cost: '199',
  });

  const [perks, setPerks] = useState(DEFAULT_PERKS);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updatePerk = (index, value) => {
    setPerks((prev) => prev.map((p, i) => (i === index ? value : p)));
  };

  const addPerk = () => setPerks((prev) => [...prev, '']);

  const removePerk = (index) => {
    setPerks((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="sv-io-wrap">
      {/* ── Brand selector ── */}
      <div className="sv-io-brand-row">
        <label className="sv-form-label">Brand</label>
        <select
          className="sv-input"
          style={{ maxWidth: 260 }}
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
        >
          {Object.values(BRANDS).map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <div className="sv-io-grid">
        {/* ── LEFT: FORM ── */}
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

          {/* ── Perks list ── */}
          <div className="sv-io-field">
            <label className="sv-form-label">Perks with this exclusive feature</label>
            {perks.map((perk, i) => (
              <div key={i} className="sv-io-perk-row">
                <input
                  className="sv-input"
                  type="text"
                  value={perk}
                  onChange={(e) => updatePerk(i, e.target.value)}
                />
                <button
                  type="button"
                  className="sv-io-perk-remove"
                  onClick={() => removePerk(i)}
                  aria-label="Remove perk"
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="sv-btn-outline sv-io-add-perk" onClick={addPerk}>
              + Add perk
            </button>
          </div>
        </div>

        {/* ── RIGHT: LIVE PREVIEW ── */}
        <div className="sv-io-preview-wrap">
          <div className="sv-io-preview">
            <div className="sv-io-preview-header">
              <span className="sv-io-logo-main" style={{ color: brand.accentColor }}>
                {brand.logoText}
              </span>
              <span className="sv-io-logo-sub">{brand.logoSubText}</span>
            </div>
            <div className="sv-io-preview-divider" style={{ background: brand.accentColor }} />

            <h2 className="sv-io-preview-title">CONFIRMATION ORDER</h2>
            <p className="sv-io-preview-date">Date – {form.date || '—'}</p>

            <div className="sv-io-preview-parties">
              <div className="sv-io-party-box">
                <div className="sv-io-party-name">{brand.name}</div>
                <div>{brand.repName}</div>
                <div>{brand.repTitle}</div>
                <div className="sv-io-party-email">{brand.repEmail}</div>
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
            <ul className="sv-io-preview-list">
              {perks.map((p, i) => <li key={i}>{p}</li>)}
            </ul>

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

            <h4 className="sv-io-preview-h4">Terms & Conditions:</h4>
            <ol className="sv-io-preview-terms">
              <li>{brand.name} is not liable for failure to publish or circulate any part of any issue(s) because of acts of God, strikes, work stoppages, national emergencies, or other circumstances beyond the control of the publisher.</li>
              <li>{brand.name} obligation shall not exceed a refund of the amount paid to {brand.name} for the advertisement(s). Will not accept any cancellations.</li>
              <li>It is up to the advertiser to contact us if the advertiser needs to change the ad material in an ongoing contract. The advertiser needs to contact {brand.name} at least two weeks before issue closing.</li>
            </ol>
          </div>

          <button type="button" className="sv-btn-primary sv-io-download-btn" disabled>
            Download PDF (coming soon)
          </button>
        </div>
      </div>
    </div>
  );
}
