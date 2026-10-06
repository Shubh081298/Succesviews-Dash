/**
 * AddEmployeeModal.jsx — Admin "Add Employee" modal.
 * Admin fills: Full Name, Gender, Designation, Employment Type, Employee Code, Default Password.
 * Everything else (personal details, bank) is completed by the employee from their portal.
 */
import { useState } from "react";
import { X, User, Briefcase, Download, Check, AlertCircle, ChevronRight } from "lucide-react";
import { useAppData } from "../../data/AppDataContext";
import { generateEmployeeProfilePDF } from "../../utils/generateEmployeeProfilePDF";

const DEPARTMENTS = ["Sales", "Operations", "Design", "Manager", "HR", "Finance", "Other"];
const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];
const EMP_TYPES = ["Full-Time", "Freelancer", "Part-Time", "Intern", "Contractor"];

function genId() { return "EMP" + Date.now().toString(36).toUpperCase(); }

const EMPTY = { name: "", gender: "", department: "", employmentType: "Full-Time", code: "", email: "", password: "1234" };

export default function AddEmployeeModal({ onClose, onAdded }) {
  const { addEmployee, showToast } = useAppData();
  const [form, setForm] = useState({ ...EMPTY });
  const [step, setStep] = useState("form");
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const requiredOk = form.name.trim() && form.gender && form.department;

  const handleSave = async () => {
    setSaving(true);
    const id = genId();
    const ok = await addEmployee({ ...form, id, teamLead: "", photo: "" });
    setSaving(false);
    if (ok) { showToast(`${form.name} added successfully!`, "success"); onAdded?.(); onClose(); }
  };

  const downloadPDF = () => generateEmployeeProfilePDF({ ...form, id: form.code || "DRAFT" });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,.55)", backdropFilter: "blur(4px)" }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "min(96vw, 560px)", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(15,23,42,.18)", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ padding: "22px 26px 18px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <User size={20} color="#2563EB" />
          </span>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0F172A" }}>Add New Employee</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>Admin fills basic details. Employee completes personal & bank info from their portal.</p>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "#94A3B8" }}><X size={18} /></button>
        </div>

        {step === "form" ? (
          <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 20 }}>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8 }}>
              <AlertCircle size={14} color="#2563EB" />
              <span style={{ fontSize: 12, color: "#1D4ED8" }}>Fields marked <strong>*</strong> are required. Employee fills personal / bank details after login.</span>
            </div>

            {/* Identity */}
            <SBlock icon={<User size={14} />} color="#2563EB" title="Identity">
              <div style={G2}>
                <Field label="Full Name *" value={form.name} onChange={(v) => set("name", v)} placeholder="e.g. Rahul Sharma" />
                <Field label="Gender *" value={form.gender} onChange={(v) => set("gender", v)} type="select" options={GENDERS} />
              </div>
            </SBlock>

            {/* Employment */}
            <SBlock icon={<Briefcase size={14} />} color="#0D9488" title="Employment">
              <div style={G2}>
                <Field label="Designation *" value={form.department} onChange={(v) => set("department", v)} type="select" options={DEPARTMENTS} />
                <Field label="Employment Type" value={form.employmentType} onChange={(v) => set("employmentType", v)} type="select" options={EMP_TYPES} />
                <Field label="Employee Code" value={form.code} onChange={(v) => set("code", v)} placeholder="e.g. EMP001" />
                <Field label="Work Email" value={form.email} onChange={(v) => set("email", v)} placeholder="work@company.com" />
                <Field label="Default Password" value={form.password} onChange={(v) => set("password", v)} placeholder="1234" hint="Employee should change after first login" style={{ gridColumn: "1 / -1" }} />
              </div>
            </SBlock>

          </div>
        ) : (
          <div style={{ padding: "28px 26px 24px", display: "flex", flexDirection: "column", gap: 18, alignItems: "center" }}>
            <span style={{ width: 60, height: 60, borderRadius: 18, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Check size={28} color="#2563EB" />
            </span>
            <div style={{ textAlign: "center" }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0F172A" }}>Confirm New Employee</h3>
              <p style={{ margin: "5px 0 0", fontSize: 13, color: "#64748B" }}>Review before saving.</p>
            </div>
            <div style={{ width: "100%", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
              {[["Full Name", form.name], ["Gender", form.gender], ["Designation", form.department], ["Employment Type", form.employmentType], ["Employee Code", form.code || "—"], ["Work Email", form.email || "—"]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#64748B" }}>{k}</span>
                  <span style={{ color: "#0F172A", fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#94A3B8", textAlign: "center" }}>Employee will be prompted to complete their profile on first login.</p>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: "14px 26px", borderTop: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={downloadPDF} style={{ border: "1px solid #E2E8F0", background: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 12.5, color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Download size={13} /> PDF
          </button>
          <div style={{ flex: 1 }} />
          {step === "form" ? (
            <>
              <button onClick={onClose} style={{ border: "1px solid #E2E8F0", background: "#fff", borderRadius: 8, padding: "9px 16px", fontSize: 13, color: "#64748B", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => setStep("confirm")} disabled={!requiredOk}
                style={{ background: requiredOk ? "#2563EB" : "#CBD5E1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: requiredOk ? "pointer" : "default", display: "flex", alignItems: "center", gap: 6 }}>
                Review & Save <ChevronRight size={14} />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep("form")} style={{ border: "1px solid #E2E8F0", background: "#fff", borderRadius: 8, padding: "9px 16px", fontSize: 13, color: "#64748B", cursor: "pointer" }}>← Edit</button>
              <button onClick={handleSave} disabled={saving} style={{ background: saving ? "#93C5FD" : "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
                {saving ? "Adding…" : "✓ Yes, Add Employee"}
              </button>
              <button onClick={onClose} style={{ border: "1px solid #FCA5A5", background: "#FFF5F5", color: "#DC2626", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}>No, Cancel</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const G2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" };

function SBlock({ icon, color, title, children }) {
  return (
    <div style={{ border: "1px solid #F1F5F9", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#FAFBFC", borderBottom: "1px solid #F1F5F9" }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, background: `${color}18`, color, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>{title}</span>
      </div>
      <div style={{ padding: "14px" }}>{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", options, placeholder, hint, style: extraStyle }) {
  const inp = type === "select" ? (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="sv-input" style={{ width: "100%" }}>
      <option value="">Select…</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  ) : (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="sv-input" style={{ width: "100%" }} />
  );
  return (
    <div style={extraStyle}>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
        {label} {hint && <span style={{ fontSize: 10.5, color: "#94A3B8", fontWeight: 400 }}>({hint})</span>}
      </label>
      {inp}
    </div>
  );
}
