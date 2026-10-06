/**
 * generateEmployeeProfilePDF.js
 * Generates a premium employee profile PDF using jsPDF.
 */
import { jsPDF } from "jspdf";

function row(doc, label, value, x, y, labelW = 44) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(String(value || "—"), x + labelW, y);
}

function sectionHeader(doc, title, y) {
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(14, y - 5, 182, 9, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(37, 99, 235);
  doc.text(title, 18, y + 0.5);
  return y + 10;
}

export function generateEmployeeProfilePDF(emp) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;

  // Header bar
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, W, 36, "F");

  // Avatar circle
  doc.setFillColor(255, 255, 255);
  doc.circle(24, 18, 11, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(37, 99, 235);
  const initials = (emp.name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  doc.text(initials, 24 - (initials.length > 1 ? 3.5 : 2), 21.5);

  // Name + designation in header
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(emp.name || "—", 40, 16);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(191, 219, 254);
  doc.text(`${emp.department || "—"}  ·  ${emp.employmentType || "Full-Time"}  ·  ID: ${emp.id || "—"}`, 40, 23);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`, 40, 29);

  let y = 50;

  // Personal Information
  y = sectionHeader(doc, "PERSONAL INFORMATION", y);
  row(doc, "Full Name", emp.name, 18, y);
  row(doc, "Gender", emp.gender, 110, y);
  y += 8;
  row(doc, "Date of Birth", emp.dob, 18, y);
  row(doc, "Personal Email", emp.personalEmail, 110, y);
  y += 8;
  row(doc, "Mobile", emp.mobile, 18, y);
  y += 8;
  row(doc, "Address", emp.address, 18, y, 44);
  y += 14;

  // Employment Details
  y = sectionHeader(doc, "EMPLOYMENT DETAILS", y);
  row(doc, "Designation", emp.department, 18, y);
  row(doc, "Employment Type", emp.employmentType, 110, y);
  y += 8;
  row(doc, "Employee Code", emp.code, 18, y);
  row(doc, "Work Email", emp.email, 110, y);
  y += 8;
  row(doc, "Team Lead", emp.teamLead, 18, y);
  row(doc, "Status", emp.status === "terminated" ? "Terminated" : "Active", 110, y);
  y += 14;

  // Bank Details
  y = sectionHeader(doc, "BANK DETAILS", y);
  row(doc, "Account Holder", emp.bankHolder, 18, y);
  row(doc, "Account Number", emp.bankAccount, 110, y);
  y += 8;
  row(doc, "Bank Name", emp.bankName, 18, y);
  row(doc, "IFSC Code", emp.bankIfsc, 110, y);
  y += 8;
  row(doc, "Branch", emp.bankBranch, 18, y);
  row(doc, "UPI ID", emp.bankUpi || "—", 110, y);
  y += 14;

  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.line(14, y, 196, y);
  y += 5;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("SuccessViews — Confidential Employee Record", 14, y);
  doc.text(`Page 1 of 1`, 185, y, { align: "right" });

  doc.save(`${(emp.name || "employee").replace(/\s+/g, "_")}_profile.pdf`);
}
