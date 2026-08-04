/**
 * helpers.js — small, pure utilities: date/currency formatting,
 * CSV export, and the blank-DSR factory. Nothing here touches React.
 */

export const genCode = () => String(Math.floor(1000 + Math.random() * 9000));

/** Normalize an assigned mail-ID entry. Supports both legacy plain strings
 *  ("mail@x.com") and the object form ({ id, project, startDate }).
 *  The admin owns `id`; the employee fills in `project` + `startDate`. */
export const normAssignedId = (x) =>
  typeof x === "string"
    ? { id: x, project: "", startDate: "" }
    : { id: (x && x.id) || "", project: (x && x.project) || "", startDate: (x && x.startDate) || "" };


// Local calendar date (YYYY-MM-DD) — NOT UTC, so "today" is correct in IST/GST
// etc. even late in the evening. Use this everywhere instead of toISOString().
export const localDateStr = (d = new Date()) => {
  const dt = d instanceof Date ? d : new Date(d);
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const getTodayStr = () => localDateStr();

/** Deterministic colour for a client/magazine domain (e.g. "AWL", "CIO Visionaries").
 *  Same name always maps to the same colour on both Admin & Designer sides — no setup. */
export const domainColor = (name) => {
  const s = String(name || "").trim().toLowerCase();
  if (!s) return { solid: "#94A3B8", bg: "#F1F5F9", fg: "#475569" };
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const sat = 62 + (h % 12); // slight variety, stays in a tasteful range
  return {
    solid: `hsl(${hue} ${sat}% 46%)`,
    bg: `hsl(${hue} ${sat}% 95%)`,
    fg: `hsl(${hue} ${Math.min(sat + 6, 72)}% 32%)`,
  };
};

export const fmtDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

export const fmtMonth = (ym) =>
  new Date(ym + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

export const fmtDateTime = (ts) =>
  ts ? new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }) : "";

export const fmtTime = (ts) =>
  ts ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";

export const fmtCurr = (v) => "$" + Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });

/** Indian salary format: 45200 -> "45,200 /-". Used only in the Salary module + payslips. */
export const fmtSalary = (v) => Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 }) + " /-";

/* ── Payslip messages ──────────────────────────────────────────
   A payslip is delivered to the employee as a normal message whose
   text is a human sentence plus a hidden [SVPAY]{json}[/SVPAY] token
   carrying the structured payslip data. This keeps everything in the
   existing `messages` table (no schema change) while giving the
   payslip viewer + PDF exact figures and line items. */
const SVPAY_RE = /\[SVPAY\]([\s\S]*?)\[\/SVPAY\]/;

export function buildPayslipMessage(payload) {
  const label = `${payload.month} ${payload.year}`;
  return `Your payslip for ${label} has been generated. [SVPAY]${JSON.stringify(payload)}[/SVPAY]`;
}

export function parsePayslipPayload(text) {
  const m = String(text || "").match(SVPAY_RE);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return null; }
}

/** Human-readable part of a payslip message (token stripped). */
export function stripPayslipPayload(text) {
  return String(text || "").replace(SVPAY_RE, "").replace(/\s+/g, " ").trim();
}

export const sum = (arr, k) => arr.reduce((a, b) => a + (Number(b[k]) || 0), 0);

export const daysDiff = (ds) =>
  Math.round((new Date(getTodayStr() + "T00:00:00") - new Date(ds + "T00:00:00")) / 86400000);

/** empLabel is shared so SalaryModule / ManagerAssignModule can use it without prop-drilling a formatter. */
export const empLabel = (e) => (e ? `${e.name}${e.id ? ` (${e.id})` : ""}` : "");

/** Turns a camelCase data key into a readable label ("emailsSent" -> "Emails Sent"). */
export const humanizeKey = (k) =>
  String(k || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());

/* Blank-row factories for the repeatable Sales DSR sections. */
export const blankLead = () => ({ clientName: "", price: "", idName: "", domain: "AWL" });
export const blankContractOrder = () => ({ clientName: "", price: "", idName: "", domain: "AWL" });
export const blankFollowup = () => ({ clientName: "", domain: "AWL" });
export const blankCall = () => ({ clientName: "", idName: "", domain: "AWL", time: "" });
export const blankSale = () => ({ amount: "", currency: "USD", idName: "" });
export const blankPayment = () => ({ amount: "", currency: "USD", idName: "" });

/** Sums the numeric `amount` field across an array of money rows (Sales / Payments). */
export const sumAmount = (arr) => (arr || []).reduce((a, r) => a + (Number(r.amount) || 0), 0);

/** Factory for a fresh, empty Daily Status Report form. */
export function blankDsr() {
  return {
    attendance: "Present",
    freshEmails: "", reminderEmails: "", workingHours: "",
    leads: [], followups: [], calls: [], sales: [], payments: [],
    contractOrders: [],
    websites: [{ name: "", description: "" }],
    // Operation DSR structured sections (stored under submission.customFields.__op)
    opWebsiteWork: [{ domain: "", today: "", pending: "" }],
    opSocial: [{ domain: "", fb: "No", fbDesc: "", ig: "No", igDesc: "", li: "No", liDesc: "" }],
    opMagazine: [{ domain: "", webLive: "No", webClient: "", digitalLive: "No", digitalClient: "" }],
    pendingTasks: "", updatesForTeamLead: "",
    customFields: {},
  };
}

/** Rebuilds a DSR form object from an existing saved submission (or returns a blank one). */
export function dsrFromExisting(ex) {
  return ex
    ? {
        attendance: ex.attendance || "Present",
        freshEmails: ex.freshEmails ?? "", reminderEmails: ex.reminderEmails ?? "",
        workingHours: ex.workingHours ?? "",
        leads: Array.isArray(ex.leads) ? ex.leads : [],
        followups: Array.isArray(ex.followups) ? ex.followups : [],
        calls: Array.isArray(ex.calls) ? ex.calls : [],
        sales: Array.isArray(ex.sales) ? ex.sales : [],
        payments: Array.isArray(ex.payments) ? ex.payments : [],
        contractOrders: Array.isArray(ex.contractOrders) ? ex.contractOrders : [],
        websites: ex.websitesData?.length ? ex.websitesData : [{ name: "", description: "" }],
        opWebsiteWork: ex.customFields?.__op?.websiteWork?.length ? ex.customFields.__op.websiteWork : [{ domain: "", today: "", pending: "" }],
        opSocial: ex.customFields?.__op?.social?.length ? ex.customFields.__op.social : [{ domain: "", fb: "No", fbDesc: "", ig: "No", igDesc: "", li: "No", liDesc: "" }],
        opMagazine: ex.customFields?.__op?.magazine?.length ? ex.customFields.__op.magazine : [{ domain: "", webLive: "No", webClient: "", digitalLive: "No", digitalClient: "" }],
        pendingTasks: ex.pendingTasks ?? "",
        updatesForTeamLead: ex.updatesForTeamLead ?? "",
        customFields: ex.customFields || {},
      }
    : blankDsr();
}

/** Triggers a browser download of `rows` (array of arrays) as a CSV file named `filename`. */
export function downloadCSV(filename, rows) {
  const csv = rows
    .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
}

/** Normalizes raw employee records (handles the legacy "array of name strings" shape too). */
export function normalizeEmps(raw) {
  return raw.map((e, i) =>
    typeof e === "string"
      ? { id: `EMP${String(i + 1).padStart(3, "0")}`, name: e, photo: "", department: "Sales", code: String(1000 + i).padStart(4, "0"), password: "1234", teamLead: "" }
      : { photo: "", department: "Sales", code: "0000", password: "1234", teamLead: "", ...e }
  );
}
