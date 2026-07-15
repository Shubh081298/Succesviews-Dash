/**
 * constants.js — brand colors, fixed lists, default values.
 */

export const FONT = "'DM Sans', Inter, system-ui, sans-serif";

export const NAVY = "#162B55";
export const BLUE = "#2DC4C4";
export const GREEN = "#5F9E30";
export const ORANGE = "#F97316";
export const PURPLE = "#A855F7";
export const AMBER = "#D97706";
export const RED = "#DC2626";

export const CHART_COLORS = [
  "#2DC4C4", "#162B55", "#5F9E30", "#D97706", "#DC2626",
  "#F97316", "#A855F7", "#06B6D4", "#EC4899", "#8B5CF6",
];

export const DEPARTMENTS = ["Sales", "Operations"];
export const FIELD_TYPES = ["text", "number", "textarea"];
export const LEAVE_STATUSES = ["Pending", "Approved", "Rejected"];
export const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AED", "Other"];
export const DEFAULT_CURRENCY = "USD";
// Lead / call / follow-up domain options (Sales DSR)
export const DOMAINS = ["AWL", "CIO", "Others"];
export const DEF_WEBSITES = ["Company Blog", "Main Website", "E-Commerce Store"];
export const DEF_TARGETS = { emailsSent: 20, newLeads: 5, callsMade: 15, salesGenerated: 1000, followUps: 10, meetings: 2 };
export const STATUSES = ["Completed", "In Progress", "Pending"];
export const ATTENDANCE = ["Present", "Half Day", "Absent"];
export const DSR_STATUSES = ["Draft", "Submitted", "Locked"];
export const PERIOD_FACTOR = { today: 1, week: 5, month: 22, year: 260 };
export const IO_STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled"];
export const DEFAULT_ADMIN_PWD = "Admin@123";
// Separate password that unlocks editing of Settings + Salary (distinct from admin login).
export const DEFAULT_SETTINGS_PWD = "Settings@123";

export const TT = { contentStyle: { fontFamily: FONT, fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" } };
export const LEG = { wrapperStyle: { fontFamily: FONT, fontSize: 12 } };
export const TICK = { fontFamily: FONT, fontSize: 10 };
