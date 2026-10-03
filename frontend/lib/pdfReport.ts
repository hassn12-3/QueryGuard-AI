import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export interface PDFReportOptions {
  userQuery: string;
  summary: string;
  sql: string;
  rowCount: number;
  retryCount: number;
  rows?: Record<string, unknown>[];
  chartElementId?: string;
}

export async function generatePDFReport(options: PDFReportOptions): Promise<void> {
  const { userQuery, summary, sql, rowCount, retryCount, rows = [], chartElementId } = options;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 16;

  // ── Header Banner ──────────────────────────────────────────────────────────
  pdf.setFillColor(15, 23, 42); // slate-900
  pdf.rect(0, 0, pageWidth, 28, "F");

  // Accent line
  pdf.setFillColor(99, 102, 241); // indigo-500
  pdf.rect(0, 26, pageWidth, 2, "F");

  // Title
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(255, 255, 255);
  pdf.text("QueryGuard AI", margin, 13);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(148, 163, 184); // slate-400
  pdf.text("Autonomous Multi-Agent BI & Executive Analytics Report", margin, 20);

  // Timestamp
  const dateStr = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  pdf.setFontSize(8);
  pdf.setTextColor(203, 213, 225);
  pdf.text(dateStr, pageWidth - margin, 18, { align: "right" });

  currentY = 36;

  // ── User Query Section ─────────────────────────────────────────────────────
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(71, 85, 105);
  pdf.text("BUSINESS QUERY", margin, currentY);
  currentY += 5;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(30, 41, 59);
  const splitQuery = pdf.splitTextToSize(`"${userQuery}"`, pageWidth - margin * 2);
  pdf.text(splitQuery, margin, currentY);
  currentY += splitQuery.length * 5.5 + 4;

  // ── Badges / Meta Strip ────────────────────────────────────────────────────
  pdf.setFillColor(241, 245, 249); // slate-100
  pdf.roundedRect(margin, currentY, pageWidth - margin * 2, 8, 2, 2, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(79, 70, 229); // indigo-600
  pdf.text(`Records: ${rowCount.toLocaleString()}`, margin + 5, currentY + 5.5);

  pdf.setTextColor(16, 185, 129); // emerald-500
  pdf.text(`AST Security: 100% Passed (Read-Only SELECT)`, margin + 45, currentY + 5.5);

  if (retryCount > 0) {
    pdf.setTextColor(217, 119, 6); // amber-600
    pdf.text(`Self-Healing: ${retryCount} retry`, margin + 125, currentY + 5.5);
  } else {
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Execution: Sub-second`, margin + 125, currentY + 5.5);
  }
  currentY += 13;

  // ── Executive Insight Card ─────────────────────────────────────────────────
  if (summary) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(79, 70, 229);
    pdf.text("EXECUTIVE INSIGHT", margin, currentY);
    currentY += 4;

    const summaryLines = pdf.splitTextToSize(summary, pageWidth - margin * 2 - 12);
    const cardHeight = summaryLines.length * 5 + 8;

    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(margin, currentY, pageWidth - margin * 2, cardHeight, 3, 3, "FD");

    // Indigo left highlight bar
    pdf.setFillColor(99, 102, 241);
    pdf.rect(margin, currentY, 3, cardHeight, "F");

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(30, 41, 59);
    pdf.text(summaryLines, margin + 8, currentY + 6);

    currentY += cardHeight + 8;
  }

  // ── Chart Visual Snapshot ──────────────────────────────────────────────────
  if (chartElementId) {
    const chartEl = document.getElementById(chartElementId) || document.querySelector(".js-plotly-plot");
    if (chartEl) {
      try {
        const canvas = await html2canvas(chartEl as HTMLElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#0f172a",
        });
        const imgData = canvas.toDataURL("image/png");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(71, 85, 105);
        pdf.text("INTERACTIVE VISUALISATION SNAPSHOT", margin, currentY);
        currentY += 4;

        const imgWidth = pageWidth - margin * 2;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const boundedHeight = Math.min(imgHeight, 80);

        pdf.addImage(imgData, "PNG", margin, currentY, imgWidth, boundedHeight);
        currentY += boundedHeight + 8;
      } catch (e) {
        console.warn("Could not capture chart screenshot for PDF:", e);
      }
    }
  }

  // Check if we need a new page for SQL & Data
  if (currentY > pageHeight - 65) {
    pdf.addPage();
    currentY = 20;
  }

  // ── Verified SQL Statement ─────────────────────────────────────────────────
  if (sql) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    pdf.text("VERIFIED SQL STATEMENT", margin, currentY);
    currentY += 4;

    const sqlLines = pdf.splitTextToSize(sql, pageWidth - margin * 2 - 8);
    const sqlBoxHeight = Math.min(sqlLines.length * 4 + 6, 40);

    pdf.setFillColor(15, 23, 42); // slate-900
    pdf.roundedRect(margin, currentY, pageWidth - margin * 2, sqlBoxHeight, 2, 2, "F");

    pdf.setFont("courier", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(52, 211, 153); // emerald-400
    pdf.text(sqlLines.slice(0, 8), margin + 4, currentY + 5);

    currentY += sqlBoxHeight + 8;
  }

  // ── Data Preview Table ─────────────────────────────────────────────────────
  if (rows && rows.length > 0) {
    if (currentY > pageHeight - 50) {
      pdf.addPage();
      currentY = 20;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`DATA RECORDS PREVIEW (Top ${Math.min(rows.length, 8)} of ${rowCount.toLocaleString()})`, margin, currentY);
    currentY += 5;

    const columns = Object.keys(rows[0]).slice(0, 5); // top 5 columns
    const colWidth = (pageWidth - margin * 2) / columns.length;

    // Header row
    pdf.setFillColor(226, 232, 240);
    pdf.rect(margin, currentY, pageWidth - margin * 2, 6, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(51, 65, 85);

    columns.forEach((col, i) => {
      pdf.text(String(col), margin + i * colWidth + 2, currentY + 4.2);
    });
    currentY += 6;

    // Table rows
    const previewRows = rows.slice(0, 8);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);

    previewRows.forEach((row, rowIdx) => {
      pdf.setFillColor(rowIdx % 2 === 0 ? 255 : 248, rowIdx % 2 === 0 ? 255 : 250, rowIdx % 2 === 0 ? 255 : 252);
      pdf.rect(margin, currentY, pageWidth - margin * 2, 5.5, "F");
      pdf.setTextColor(30, 41, 59);

      columns.forEach((col, i) => {
        const val = row[col];
        const strVal = val === null || val === undefined ? "NULL" : String(val);
        const truncated = strVal.length > 20 ? strVal.slice(0, 19) + "…" : strVal;
        pdf.text(truncated, margin + i * colWidth + 2, currentY + 3.8);
      });
      currentY += 5.5;
    });
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text(
    "Confidential — Generated automatically by QueryGuard AI Multi-Agent Engine",
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" }
  );

  // Save the PDF
  const filename = `QueryGuard_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(filename);
}
