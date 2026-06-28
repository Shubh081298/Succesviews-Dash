/**
 * helpers.js
 * ─────────────────────────────────────────────────────────────
 * Small, pure utility functions used throughout the dashboard:
 * date formatting, currency formatting, CSV export, and the
 * blank-DSR factory. Nothing here touches React or storage.
 */

export const genCode = () => String(Math.floor(1000 + Math.random() * 9000));

export const getTodayStr = () => new Date().toISOString().split("T")[0];

export const fmtDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

export const fmtMonth = (ym) =>
  new Date(ym + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

export const fmtDateTime = (ts) =>
  ts ? new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }) : "";

export const fmtTime = (ts) =>
  ts ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";

export const fmtCurr = (v) => "₹" + Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const sum = (arr, k) => arr.reduce((a, b) => a + (Number(b[k]) || 0), 0);

export const daysDiff = (ds) =>
  Math.round((new Date(getTodayStr() + "T00:00:00") - new Date(ds + "T00:00:00")) / 86400000);

/** empLabel is shared so SalaryModule / ManagerAssignModule can use it without prop-drilling a formatter. */
export const empLabel = (e) => (e ? `${e.name}${e.id ? ` (${e.id})` : ""}` : "");

/** Turns a camelCase data key (e.g. "emailsSent") into a readable label ("Emails Sent")
 *  for places where object keys are rendered directly as field labels (e.g. Settings → Daily Targets). */
export const humanizeKey = (k) =>
  String(k || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());

/** Factory for a fresh, empty Daily Status Report form. */
export function blankDsr() {
  return {
    attendance: "Present",
    freshEmails: "", reminderEmails: "", newLeadsInterested: "", newFollowUps: "", callsScheduled: "",
    salesGenerated: "", paymentReceived: "", currency: "INR", workingHours: "",
    websites: [{ name: "", description: "" }],
    pendingTasks: "", challengesFaced: "", updatesForTeamLead: "", remarks: "",
    customFields: {},
  };
}

/** Rebuilds a DSR form object from an existing saved submission (or returns a blank one). */
export function dsrFromExisting(ex) {
  return ex
    ? {
        attendance: ex.attendance || "Present",
        freshEmails: ex.freshEmails ?? "", reminderEmails: ex.reminderEmails ?? "",
        newLeadsInterested: ex.newLeadsInterested ?? "", newFollowUps: ex.newFollowUps ?? "",
        callsScheduled: ex.callsScheduled ?? "", salesGenerated: ex.salesGenerated ?? "",
        paymentReceived: ex.paymentReceived ?? "", currency: ex.currency || "INR",
        workingHours: ex.workingHours ?? "",
        websites: ex.websitesData?.length ? ex.websitesData : [{ name: "", description: "" }],
        pendingTasks: ex.pendingTasks ?? "", challengesFaced: ex.challengesFaced ?? "",
        updatesForTeamLead: ex.updatesForTeamLead ?? "", remarks: ex.remarks ?? "",
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
