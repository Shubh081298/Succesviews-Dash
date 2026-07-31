/**
 * crmWorkflow.js — single source of truth for the CRM → production workflow.
 * Shared by the Employee Pipeline and the Admin Client Pipeline so both
 * portals drive the exact same stages, colours, and gating.
 */

// Early "nurture" statuses the employee can set manually before the workflow.
export const NURTURE_STATUSES = [
  "New Lead", "Follow-up Required", "Contacted", "Interested",
  "Waiting for Response", "Meeting Scheduled", "Not Interested", "Lost",
];

export const DEAD = ["Not Interested", "Lost", "Cancelled"];

// Statuses that may ONLY be reached through the workflow buttons (never typed
// manually) — so an employee can't skip Contract → Sale → Payment gates.
export const WORKFLOW_CONTROLLED = [
  "Contract Sent", "Sales Generated", "Sale Closed",
  "Payment Pending", "Payment Received", "Payment Completed",
  "Completed", "Project Closed",
];

// Every stage's brand colour (used for badges, dots, buttons, stepper).
export const STAGE_COLOURS = {
  "New Lead": "#2563EB", "Follow-up Required": "#EA580C", "Contacted": "#0891B2",
  "Interested": "#16A34A", "Waiting for Response": "#D97706", "Meeting Scheduled": "#4F46E5",
  "Not Interested": "#64748B", "Lost": "#DC2626", "Cancelled": "#78716C",
  "Contract Sent": "#7C3AED", "Sales Generated": "#0D9488",
  "Payment Pending": "#E11D48", "Payment Completed": "#059669", "Payment Received": "#059669",
  "Proceed to Design": "#2563EB", "Design Completed": "#4F46E5",
  "Website Live": "#0EA5E9", "Digital Magazine Live": "#DB2777",
  "Project Closed": "#15803D", "Completed": "#15803D",
};
export const stageColour = (s) => STAGE_COLOURS[s] || "#64748B";

// Ordered production steps shown in the stepper.
export const WORKFLOW_STEPS = [
  "Contract Sent", "Sales Generated", "Payment Completed", "Completed",
];

// Map a status → how far along the production workflow it is (0 = still nurturing).
const STAGE_INDEX = {
  "Contract Sent": 1, "Sales Generated": 2,
  "Payment Completed": 3, "Payment Received": 3,
  "Completed": 4, "Project Closed": 4,
};
export const progressOf = (status) => (DEAD.includes(status) ? -1 : (STAGE_INDEX[status] || 0));
export const isClosed = (status) => progressOf(status) >= 4;

// The single next action available at each progress level.
export const WORKFLOW = [
  { at: 0, label: "Contract Sent", to: "Contract Sent", kind: "contract", colour: "#7C3AED", dateLabel: "Sent date", confirm: "Mark the contract as sent to this client?" },
  { at: 1, label: "Sales Generated", to: "Sales Generated", kind: "sale", colour: "#0D9488", dateLabel: "Completion date", confirm: "Confirm the client signed the contract and the sale is generated?" },
  { at: 2, label: "Payment Received", to: "Payment Completed", kind: "payment", colour: "#059669", dateLabel: "Payment received date", confirm: "Confirm payment has been received?" },
  { at: 3, label: "Mark Completed", to: "Completed", kind: "stage", colour: "#15803D", confirm: "Mark this project as completed and closed?" },
];

export const nextAction = (status) => {
  const p = progressOf(status);
  if (p < 0 || p >= 4) return null;
  return WORKFLOW.find((w) => w.at === p) || null;
};
