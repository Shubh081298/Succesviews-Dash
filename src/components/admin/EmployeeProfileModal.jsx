/**
 * EmployeeProfileModal.jsx — Full employee profile viewer + editor for admins.
 * View mode: premium card layout. Edit mode: inline fields for all profile data.
 * PDF download available in both modes.
 */
import { useState } from "react";
import { X, Download, Pencil, Check, User, Briefcase, Landmark, Phone, Mail, MapPin, Calendar, CreditCard, Building, BadgeCheck } from "lucide-react";
import { generateEmployeeProfilePDF } from "../../utils/generateEmployeeProfilePDF";
import { Avatar } from "../ui";

const DEPARTMENTS = ["Sales", "Operations", "Design", "Manager", "HR", "Finance", "Other"];
const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];
const EMP_TYPES = ["Full-Time", "Freelancer", "Part-Time", "Intern", "Contractor"];

const DEPT_COLORS = {
  Sales: { bg: "#EFF6FF", color: "#2563EB" },
  Operations: { bg: "#ECFDF5", color: "#059669" },
  Design: { bg: "#FDF4FF", color: "#9333EA" },
  Manager: { bg: "#FFF7ED", color: "#EA580C" },
  HR: { bg: "#FFF1F2", color: "#E11D48" },
  Finance: { bg: "#F0FDF4", color: "#16A34A" },
};
function dc(dept) { return DEPT_COLORS[dept] || { bg: "#F8FAFC", color: "#475569" }; }

function isComplete(e) {
  return !!(e && e.mobile && e.dob && e.personalEmail && e.address &&
    e.bankAccount && e.bankName && e.bankIfsc && e.bankBranch && e.bankHolder);
}

/* ── View mode helpers ────────────────────────────────────────── */
function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
      <span style={{ width: 26, height: 26, borderRadius: 6, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: 13, color: value ? "#0F172A" : "#CBD5E1", fontWeight: 500 }}>{value || "Not filled yet"}</div>
      </div>
    </div>
  );
}

function Section({ title, icon, color, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <span style={{ width: 24, height: 24, borderRadius: 6, background: `${color}18`, color, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</span>
      </div>
      <div style={{ background: "#FAFBFC", border: "1px solid #F1F5F9", borderRadius: 10, padding: "2px 14px" }}>{children}</div>
    </div>
  );
}

/* ── Edit mode field ──────────────────────────────────────────── */
function EField({ label, value, onChange, type = "text", options, placeholder }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
      {type === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="sv-input" style={{ width: "100%" }}>
          <option value="">— select —</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2}
          className="sv-input" style={{ width: "100%", resize: "vertical" }} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="sv-input" style={{ width: "100%" }} />
      )}
    </div>
  );
}

const G2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" };

export default function EmployeeProfileModal({ emp, onClose, onSave }) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({ ...emp });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setDraft((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await onSave?.(draft);
    setSaving(false);
    setEditMode(false);
  };

  const displayed = editMode ? draft : emp;
  const { bg, color } = dc(displayed.department);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,.55)", backdropFilter: "blur(4px)" }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "min(96vw, 700px)", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(15,23,42,.2)", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ padding: "20px 22px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <Avatar emp={displayed} size={52} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0F172A" }}>{displayed.name || "—"}</h2>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: bg, color }}>{displayed.department || "—"}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 600, padding: "2px 9px", borderRadius: 20,
                background: isComplete(displayed) ? "#ECFDF5" : "#FFF7ED",
                color: isComplete(displayed) ? "#059669" : "#EA580C",
                border: `1px solid ${isComplete(displayed) ? "#A7F3D0" : "#FED7AA"}` }}>
                {isComplete(displayed) ? <BadgeCheck size={11} /> : "⚠"} {isComplete(displayed) ? "Complete" : "Incomplete"}
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748B" }}>
              {displayed.employmentType || "Full-Time"} · ID: {displayed.id || "—"}
              {displayed.status === "terminated" && <span style={{ marginLeft: 8, fontSize: 11, background: "#FFF1F2", color: "#E11D48", border: "1px solid #FECDD3", borderRadius: 20, padding: "1px 8px" }}>Terminated</span>}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "flex-start" }}>
            <button onClick={() => generateEmployeeProfilePDF(displayed)}
              style={{ display: "flex", alignItems: "center", gap: 5, border: "1px solid #E2E8F0", background: "#F8FAFC", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "#475569", cursor: "pointer", fontWeight: 600 }}>
              <Download size={13} /> PDF
            </button>
            {!editMode ? (
              <button onClick={() => { setDraft({ ...emp }); setEditMode(true); }}
                style={{ display: "flex", alignItems: "center", gap: 5, border: "1px solid #BFDBFE", background: "#EFF6FF", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "#2563EB", cursor: "pointer", fontWeight: 600 }}>
                <Pencil size={13} /> Edit
              </button>
            ) : (
              <button onClick={() => setEditMode(false)}
                style={{ border: "1px solid #E2E8F0", background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "#64748B", cursor: "pointer" }}>
                Cancel
              </button>
            )}
            <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 5, borderRadius: 7, color: "#94A3B8" }}><X size={17} /></button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 22px" }}>
          {editMode ? (
            /* ── Edit mode ─────────────────────────────────────── */
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Personal */}
              <EditSection title="Personal Information" icon={<User size={13} />} color="#2563EB">
                <div style={G2}>
                  <EField label="Full Name" value={draft.name} onChange={(v) => set("name", v)} placeholder="Full name" />
                  <EField label="Gender" value={draft.gender} onChange={(v) => set("gender", v)} type="select" options={GENDERS} />
                  <EField label="Date of Birth" value={draft.dob} onChange={(v) => set("dob", v)} type="date" />
                  <EField label="Personal Email" value={draft.personalEmail} onChange={(v) => set("personalEmail", v)} placeholder="personal@email.com" />
                  <EField label="Mobile" value={draft.mobile} onChange={(v) => set("mobile", v)} placeholder="+91 9876543210" />
                </div>
                <div style={{ marginTop: 10 }}>
                  <EField label="Address" value={draft.address} onChange={(v) => set("address", v)} type="textarea" placeholder="Full residential address" />
                </div>
              </EditSection>

              {/* Employment */}
              <EditSection title="Employment Details" icon={<Briefcase size={13} />} color="#0D9488">
                <div style={G2}>
                  <EField label="Designation" value={draft.department} onChange={(v) => set("department", v)} type="select" options={DEPARTMENTS} />
                  <EField label="Employment Type" value={draft.employmentType} onChange={(v) => set("employmentType", v)} type="select" options={EMP_TYPES} />
                  <EField label="Employee Code" value={draft.code} onChange={(v) => set("code", v)} placeholder="EMP001" />
                  <EField label="Work Email" value={draft.email} onChange={(v) => set("email", v)} placeholder="work@company.com" />
                  <EField label="Team Lead" value={draft.teamLead} onChange={(v) => set("teamLead", v)} placeholder="Team lead name" />
                </div>
              </EditSection>

              {/* Bank */}
              <EditSection title="Bank Details" icon={<Landmark size={13} />} color="#7C3AED">
                <div style={G2}>
                  <EField label="Account Holder Name" value={draft.bankHolder} onChange={(v) => set("bankHolder", v)} placeholder="As per bank records" />
                  <EField label="Account Number" value={draft.bankAccount} onChange={(v) => set("bankAccount", v)} placeholder="XXXXXXXXXXXX" />
                  <EField label="Bank Name" value={draft.bankName} onChange={(v) => set("bankName", v)} placeholder="e.g. HDFC Bank" />
                  <EField label="IFSC Code" value={draft.bankIfsc} onChange={(v) => set("bankIfsc", v)} placeholder="e.g. HDFC0001234" />
                  <EField label="Branch Location" value={draft.bankBranch} onChange={(v) => set("bankBranch", v)} placeholder="e.g. Pune Main" />
                  <EField label="UPI ID (optional)" value={draft.bankUpi} onChange={(v) => set("bankUpi", v)} placeholder="name@bank" />
                </div>
              </EditSection>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
                <button onClick={() => setEditMode(false)} style={{ border: "1px solid #E2E8F0", background: "#fff", borderRadius: 9, padding: "10px 18px", fontSize: 13, color: "#64748B", cursor: "pointer" }}>Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  style={{ background: saving ? "#93C5FD" : "#2563EB", color: "#fff", border: "none", borderRadius: 9, padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <Check size={14} /> {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          ) : (
            /* ── View mode ─────────────────────────────────────── */
            <>
              <Section title="Personal Information" icon={<User size={13} />} color="#2563EB">
                <InfoRow icon={<User size={12} color="#64748B" />} label="Full Name" value={emp.name} />
                <InfoRow icon={<span style={{ fontSize: 11 }}>⚧</span>} label="Gender" value={emp.gender} />
                <InfoRow icon={<Calendar size={12} color="#64748B" />} label="Date of Birth" value={emp.dob} />
                <InfoRow icon={<Mail size={12} color="#64748B" />} label="Personal Email" value={emp.personalEmail} />
                <InfoRow icon={<Phone size={12} color="#64748B" />} label="Mobile" value={emp.mobile} />
                <InfoRow icon={<MapPin size={12} color="#64748B" />} label="Address" value={emp.address} />
              </Section>

              <Section title="Employment Details" icon={<Briefcase size={13} />} color="#0D9488">
                <InfoRow icon={<Briefcase size={12} color="#64748B" />} label="Designation" value={emp.department} />
                <InfoRow icon={<BadgeCheck size={12} color="#64748B" />} label="Employment Type" value={emp.employmentType} />
                <InfoRow icon={<span style={{ fontSize: 11 }}>#</span>} label="Employee Code" value={emp.code} />
                <InfoRow icon={<Mail size={12} color="#64748B" />} label="Work Email" value={emp.email} />
                <InfoRow icon={<User size={12} color="#64748B" />} label="Team Lead" value={emp.teamLead} />
              </Section>

              <Section title="Bank Details" icon={<Landmark size={13} />} color="#7C3AED">
                {!(emp.bankAccount || emp.bankHolder) ? (
                  <div style={{ padding: "12px 0", color: "#94A3B8", fontSize: 13, textAlign: "center" }}>Bank details not filled — employee can add from their portal, or admin can edit.</div>
                ) : (
                  <>
                    <InfoRow icon={<User size={12} color="#64748B" />} label="Account Holder Name" value={emp.bankHolder} />
                    <InfoRow icon={<CreditCard size={12} color="#64748B" />} label="Account Number" value={emp.bankAccount} />
                    <InfoRow icon={<Building size={12} color="#64748B" />} label="Bank Name" value={emp.bankName} />
                    <InfoRow icon={<span style={{ fontSize: 11 }}>🏦</span>} label="IFSC Code" value={emp.bankIfsc} />
                    <InfoRow icon={<MapPin size={12} color="#64748B" />} label="Branch" value={emp.bankBranch} />
                    {emp.bankUpi && <InfoRow icon={<span style={{ fontSize: 11 }}>📲</span>} label="UPI ID" value={emp.bankUpi} />}
                  </>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EditSection({ title, icon, color, children }) {
  return (
    <div style={{ border: "1px solid #F1F5F9", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 14px", background: "#FAFBFC", borderBottom: "1px solid #F1F5F9" }}>
        <span style={{ width: 24, height: 24, borderRadius: 6, background: `${color}18`, color, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
      </div>
      <div style={{ padding: "14px" }}>{children}</div>
    </div>
  );
}
