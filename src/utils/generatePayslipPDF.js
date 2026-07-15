/**
 * generatePayslipPDF.js
 * ─────────────────────────────────────────────────────────────
 * Generates a professional styled payslip PDF using jsPDF.
 * Called from the employee dashboard when they click "Download Payslip".
 *
 * Usage:
 *   import { generatePayslipPDF } from '../../utils/generatePayslipPDF';
 *   generatePayslipPDF({ employee, message, logo });
 */

/**
 * Parse the payslip message text into structured data.
 * Message format: "📄 Payslip — Fixed: ₹5,000, Incentives: ₹0, Total: ₹5,000 (2026-07-01)"
 */
import { parsePayslipPayload, fmtSalary } from "./helpers.js";

function parsePayslipMessage(text) {
  const payload = parsePayslipPayload(text);
  if (payload) {
    return {
      fixed: fmtSalary(payload.fixed),
      incentives: fmtSalary(payload.incentiveTotal),
      deduction: (payload.deductionTotal || 0) > 0 ? "- " + fmtSalary(payload.deductionTotal) : "N/A",
      total: fmtSalary(payload.total),
      date: payload.date || new Date().toISOString().slice(0, 10),
    };
  }
  const norm = (m) => (m ? m.replace(/[₹$]/g, "").trim() + " /-" : "0 /-");
  const fixed      = norm(text.match(/[Ff]ixed[:\s]+([₹$][\d,]+)/)?.[1]);
  const incentives = norm(text.match(/[Ii]ncentives[:\s]+([₹$][\d,]+)/)?.[1]);
  const total      = norm(text.match(/[Tt]otal[:\s]+([₹$][\d,]+)/)?.[1]);
  const dateMatch  = text.match(/\((\d{4}-\d{2}-\d{2})\)/);
  const date       = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
  return { fixed, incentives, deduction: "N/A", total, date };
}

/**
 * Format a date string into a readable format.
 * "2026-07-01" → "01 July 2026"
 */
function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit", month: "long", year: "numeric"
    });
  } catch {
    return dateStr;
  }
}

/**
 * Main PDF generator function.
 * @param {Object} params
 * @param {Object} params.employee  - { name, department, id, teamLead, email }
 * @param {string} params.message   - Raw payslip message text from the messages table
 * @param {string} params.logo      - Base64 data URL of the company logo (optional)
 */
export async function generatePayslipPDF({ employee, message, logo }) {
  // Dynamically import jsPDF (must be installed: npm install jspdf)
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210; // A4 width mm
  const margin = 18;
  const contentW = W - margin * 2;

  // ── Colors ──────────────────────────────────────────────────
  const navy    = [15,  23,  42];   // #0F172A
  const teal    = [13, 148, 136];   // #0D9488
  const white   = [255, 255, 255];
  const light   = [248, 250, 252];  // #F8FAFC
  const border  = [226, 232, 240];  // #E2E8F0
  const muted   = [100, 116, 139];  // #64748B
  const dark    = [15,  23,  42];

  // ── Parse message ────────────────────────────────────────────
  const { fixed, incentives, deduction, total, date } = parsePayslipMessage(message);
  const periodLabel = formatDate(date);
  const month = new Date(date).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  // ── Header background ────────────────────────────────────────
  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 48, "F");

  // ── Logo ─────────────────────────────────────────────────────
  if (logo && logo.startsWith("data:image")) {
    try {
      doc.addImage(logo, "PNG", margin, 10, 28, 28);
    } catch {}
  }

  // ── Company name & payslip title ─────────────────────────────
  doc.setTextColor(...white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("SuccessViews", logo ? margin + 32 : margin, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(148, 213, 202);
  doc.text("Employee Payslip", logo ? margin + 32 : margin, 30);

  // Period badge (top right)
  doc.setFillColor(...teal);
  doc.roundedRect(W - margin - 44, 14, 44, 16, 3, 3, "F");
  doc.setTextColor(...white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(month, W - margin - 22, 23, { align: "center" });

  // ── Divider line ─────────────────────────────────────────────
  let y = 56;
  doc.setDrawColor(...teal);
  doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  y += 8;

  // ── Employee info section ─────────────────────────────────────
  doc.setFillColor(...light);
  doc.roundedRect(margin, y, contentW, 36, 3, 3, "F");
  doc.setDrawColor(...border);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW, 36, 3, 3, "S");

  // Left column
  const col1x = margin + 8;
  const col2x = margin + contentW / 2 + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...dark);
  doc.text(employee.name || "Employee", col1x, y + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(`Department: ${employee.department || "—"}`, col1x, y + 19);
  doc.text(`Employee ID: ${employee.id || "—"}`, col1x, y + 26);
  doc.text(`Email: ${employee.email || "—"}`, col1x, y + 33);

  // Right column
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(`Pay Period:`, col2x, y + 11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text(periodLabel, col2x + 22, y + 11);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...muted);
  doc.text(`Team Lead:`, col2x, y + 19);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...dark);
  doc.text(employee.teamLead || "—", col2x + 22, y + 19);

  y += 44;

  // ── Earnings table ────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...navy);
  doc.text("Earnings Breakdown", margin, y);
  y += 6;

  // Table header
  doc.setFillColor(...navy);
  doc.rect(margin, y, contentW, 9, "F");
  doc.setTextColor(...white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Component", margin + 6, y + 6);
  doc.text("Amount", W - margin - 6, y + 6, { align: "right" });
  y += 9;

  // Table rows
  const rows = [
    { label: "Fixed Salary", amount: fixed, desc: "Monthly base salary" },
    { label: "Incentives / Bonus", amount: incentives, desc: "Performance incentives" },
    { label: "Deductions", amount: deduction, desc: "Deductions applied" },
  ];

  rows.forEach((row, i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 252);
    doc.rect(margin, y, contentW, 12, "F");
    doc.setDrawColor(...border);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentW, 12, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...dark);
    doc.text(row.label, margin + 6, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(row.desc, margin + 6, y + 10);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...teal);
    doc.text(row.amount, W - margin - 6, y + 7, { align: "right" });

    y += 12;
  });

  y += 4;

  // ── Total box ─────────────────────────────────────────────────
  doc.setFillColor(...teal);
  doc.roundedRect(margin, y, contentW, 16, 3, 3, "F");
  doc.setTextColor(...white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("NET SALARY", margin + 8, y + 10);
  doc.setFontSize(14);
  doc.text(total, W - margin - 8, y + 10, { align: "right" });
  y += 24;

  // ── Note ─────────────────────────────────────────────────────
  doc.setFillColor(254, 252, 232); // light yellow
  doc.roundedRect(margin, y, contentW, 12, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(133, 77, 14);
  doc.text(
    "This is a system-generated payslip and does not require a signature.",
    margin + 6, y + 7
  );
  y += 20;

  // ── Footer ────────────────────────────────────────────────────
  doc.setDrawColor(...border);
  doc.setLineWidth(0.3);
  doc.line(margin, y, W - margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text("SuccessViews — Confidential Document", margin, y);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, W - margin, y, { align: "right" });

  // ── Save ──────────────────────────────────────────────────────
  const fileName = `Payslip_${(employee.name || "Employee").replace(/\s+/g, "_")}_${date}.pdf`;
  doc.save(fileName);
}
