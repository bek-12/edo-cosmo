"use client";
import { useEffect, useState, useCallback } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { DollarSign, Calendar, RotateCcw, X, AlertTriangle, CheckCircle, Download } from "lucide-react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ── Types ── */
interface SaleItem {
  id: string; productId: string;
  product: { name: string };
  quantity: number; priceAtSale: number;
}
interface ReturnItem { productId: string; quantity: number; maxQty: number; priceAtSale: number; productName: string; }
interface SaleReturn { items: { productId: string; quantity: number }[]; }
interface Sale {
  id: string; createdAt: string; totalAmount: number;
  cashier: { name: string }; items: SaleItem[]; returns?: SaleReturn[];
}
interface SummaryTopProduct {
  productName: string; unitsSold: number; revenue: number;
}
interface SummaryDay { label: string; revenue: number; spent: number; }
interface SummaryData {
  period: string; totalSales: number; totalRevenue: number; totalSpent: number;
  netProfit: number; isLoss: boolean; returnRate: number;
  topProducts: SummaryTopProduct[]; salesByDay: SummaryDay[];
}

/* ── Purchase Report Types ── */
interface SpendingDay { date: string; amount: number; }
interface TopRestockedProduct { productId: string; productName: string; category: string; totalQty: number; totalCost: number; }
interface RecentPurchase { id: string; date: string; productName: string; category: string; quantity: number; buyingPrice: number; totalCost: number; restockedBy: string; }
interface PurchaseReport {
  period: string; totalSpent: number; totalPurchases: number; totalUnitsRestocked: number;
  spendingByDay: SpendingDay[]; topRestockedProducts: TopRestockedProduct[]; recentPurchases: RecentPurchase[];
}

/* ── Helpers ── */
const fmt = (n: number) =>
  new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 })
    .format(n).replace("ETB", "Birr");

const fmtDate = (d: string) =>
  new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

const fmtDateShort = (d: string) =>
  new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const hoursSince = (d: string) => (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60);

function exportCSV(summary: SummaryData) {
  const rows = [
    ["Period", summary.period],
    ["Total Sales", summary.totalSales],
    ["Total Revenue", summary.totalRevenue],
    ["Total Spent", summary.totalSpent],
    ["Net Profit", summary.netProfit],
    ["Return Rate", `${summary.returnRate}%`],
    [],
    ["Rank", "Product", "Units Sold", "Revenue"],
    ...summary.topProducts.map((p, i) => [i + 1, p.productName, p.unitsSold, p.revenue]),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `report-${summary.period}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function fmtBirr(n: number) {
  return new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 })
    .format(n).replace("ETB", "Birr");
}

function exportPurchaseCSV(report: PurchaseReport) {
  const rows = [
    ["Period", report.period],
    ["Total Spent", report.totalSpent],
    ["Purchases Made", report.totalPurchases],
    ["Units Restocked", report.totalUnitsRestocked],
    [],
    ["Date", "Product", "Category", "Qty", "Buying Price", "Total Cost", "Restocked By"],
    ...report.recentPurchases.map((p) => [
      new Date(p.date).toLocaleString(), p.productName, p.category,
      p.quantity, p.buyingPrice, p.totalCost, p.restockedBy,
    ]),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `purchases-${report.period}.csv`; a.click();
  URL.revokeObjectURL(url);
}

async function exportPurchasePDF(report: PurchaseReport) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const INDIGO = [79, 70, 229]   as [number, number, number];
  const DARK   = [17, 24, 39]    as [number, number, number];
  const GRAY   = [107, 114, 128] as [number, number, number];
  const periodLabel = report.period.charAt(0).toUpperCase() + report.period.slice(1);
  const now = new Date().toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  let y = 18;
  doc.setFillColor(...INDIGO);
  doc.rect(0, 0, 210, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("Cosmetics Shop — Purchases Report", 14, 9.5);
  doc.setTextColor(...DARK); doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text(`${periodLabel} Purchases`, 14, y + 6); y += 14;
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
  doc.text(`Generated: ${now}`, 14, y); y += 10;
  // KPIs
  const kpis = [
    { label: "Total Spent",       value: fmtBirr(report.totalSpent) },
    { label: "Purchases Made",    value: String(report.totalPurchases) },
    { label: "Units Restocked",   value: String(report.totalUnitsRestocked) },
  ];
  const boxW = 58, boxH = 16, gap = 3, startX = 14;
  kpis.forEach((kpi, i) => {
    const x = startX + i * (boxW + gap);
    doc.setFillColor(248, 250, 252); doc.roundedRect(x, y, boxW, boxH, 2, 2, "F");
    doc.setDrawColor(224, 231, 255); doc.roundedRect(x, y, boxW, boxH, 2, 2, "S");
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
    doc.text(kpi.label.toUpperCase(), x + 3, y + 5);
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK);
    doc.text(kpi.value, x + 3, y + 12);
  });
  y += boxH + 10;
  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK);
  doc.text("Recent Purchases", 14, y); y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Date", "Product", "Category", "Qty", "Unit Price", "Total"]],
    body: report.recentPurchases.map((p) => [
      new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      p.productName, p.category, String(p.quantity),
      fmtBirr(p.buyingPrice), fmtBirr(p.totalCost),
    ]),
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: INDIGO, textColor: [255, 255, 255] as [number,number,number], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 32 }, 1: { cellWidth: 50 }, 2: { cellWidth: 28 },
      3: { cellWidth: 14, halign: "center" }, 4: { cellWidth: 28, halign: "right" }, 5: { cellWidth: 30, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });
  doc.save(`purchases-${report.period}-${new Date().toISOString().split("T")[0]}.pdf`);
}

async function exportPDF(summary: SummaryData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const periodLabel = summary.period.charAt(0).toUpperCase() + summary.period.slice(1);
  const now = new Date().toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const ROSE   = [225, 29,  72]  as [number, number, number];
  const GREEN  = [5,   150, 105] as [number, number, number];
  const RED    = [220, 38,  38]  as [number, number, number];
  const DARK   = [17,  24,  39]  as [number, number, number];
  const GRAY   = [107, 114, 128] as [number, number, number];
  const LIGHT  = [249, 250, 251] as [number, number, number];

  let y = 18;

  // ── Header ───────────────────────────────────────────────────────────────
  doc.setFillColor(...ROSE);
  doc.rect(0, 0, 210, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Cosmetics Shop — Sales Report", 14, 9.5);

  doc.setTextColor(...DARK);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`${periodLabel} Summary`, 14, y + 6);
  y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(`Generated: ${now}`, 14, y + 4);
  y += 12;

  // ── KPI boxes ────────────────────────────────────────────────────────────
  const kpis = [
    { label: "Total Sales",  value: String(summary.totalSales),               color: DARK },
    { label: "Revenue",      value: fmtBirr(summary.totalRevenue),           color: DARK },
    { label: "Total Spent",  value: fmtBirr(summary.totalSpent),             color: DARK },
    {
      label: summary.isLoss ? "Net Loss" : "Net Profit",
      value: `${summary.isLoss ? "−" : "+"}${fmtBirr(Math.abs(summary.netProfit))}`,
      color: summary.isLoss ? RED : GREEN,
    },
  ];

  const boxW = 43, boxH = 18, gap = 3, startX = 14;
  kpis.forEach((kpi, i) => {
    const x = startX + i * (boxW + gap);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, "F");
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, "S");
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text(kpi.label.toUpperCase(), x + 3, y + 5);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, x + 3, y + 13);
  });
  y += boxH + 10;

  // ── Top Products table ────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text("Top Products", 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["#", "Product", "Units Sold", "Revenue"]],
    body: summary.topProducts.map((p, i) => [
      String(i + 1),
      p.productName,
      String(p.unitsSold),
      fmtBirr(p.revenue),
    ]),
    theme: "striped",
    styles: {
      fontSize: 10,
      cellPadding: 6,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: ROSE,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: "bold",
      halign: "left",
    },
    tableWidth: 182,
    columnStyles: {
      0: { cellWidth: 20, halign: "center" },
      1: { cellWidth: 92, halign: "left" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 40, halign: "right", textColor: [225, 29, 72] as [number, number, number], fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(`Return Rate: ${summary.returnRate}%   ·   Cosmetics Shop Sales & Inventory System`, 14, finalY);

  // ── Save ──────────────────────────────────────────────────────────────────
  doc.save(`report-${summary.period}-${new Date().toISOString().split("T")[0]}.pdf`);
}

/* ── Summary Section Component ── */
function SummarySection({ onSummaryReady }: { onSummaryReady: (s: SummaryData | null) => void }) {
  const [period, setPeriod] = useState<"weekly" | "monthly" | "yearly">("weekly");
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSummary = useCallback(() => {
    setLoading(true);
    api.get(`/api/reports/summary?period=${period}`)
      .then((r) => { setSummary(r.data); onSummaryReady(r.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period, onSummaryReady]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const tabs = [
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
    { key: "yearly", label: "Yearly" },
  ] as const;

  return (
    <div className="mb-6 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header row: title + toggles only */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 pt-4 border-b border-gray-100 pb-3">
        <h2 className="text-sm sm:text-base font-semibold text-gray-800">Summary Report</h2>
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setPeriod(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                period === t.key ? "bg-rose-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
        ) : summary ? (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: "Total Sales", value: String(summary.totalSales), sub: "transactions" },
                { label: "Revenue", value: fmt(summary.totalRevenue), sub: "after returns" },
                { label: "Spent", value: fmt(summary.totalSpent), sub: "buying cost" },
                {
                  label: summary.isLoss ? "Net Loss" : "Net Profit",
                  value: `${summary.isLoss ? "−" : "+"}${fmt(Math.abs(summary.netProfit))}`,
                  sub: `Return rate ${summary.returnRate}%`,
                  accent: summary.isLoss ? "text-red-600" : "text-emerald-600",
                },
              ].map((kpi, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">{kpi.label}</p>
                  <p className={`text-base sm:text-lg font-bold mt-0.5 ${kpi.accent ?? "text-gray-800"}`}>{kpi.value}</p>
                  <p className="text-xs text-gray-400">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Bar chart */}
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Revenue vs Spending</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={summary.salesByDay} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="spent" name="Spent" fill="#d1d5db" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top products table */}
            <div>
              <h3 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Top Products</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                      <th className="pb-2 font-medium w-8">#</th>
                      <th className="pb-2 font-medium">Product</th>
                      <th className="pb-2 font-medium text-right">Units</th>
                      <th className="pb-2 font-medium text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topProducts.length === 0 ? (
                      <tr><td colSpan={5} className="py-4 text-center text-gray-400 text-xs">No data</td></tr>
                    ) : summary.topProducts.map((p, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-2 text-gray-400 font-bold text-xs">{i + 1}</td>
                        <td className="py-2 font-medium text-gray-700 text-xs">{p.productName}</td>
                        <td className="py-2 text-right text-gray-600 text-xs">{p.unitsSold}</td>
                        <td className="py-2 text-right font-semibold text-rose-600 text-xs">{fmt(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ── Purchases Section Component ── */
function PurchasesSection({ onReportReady }: { onReportReady: (r: PurchaseReport | null) => void }) {
  const [period, setPeriod] = useState<"weekly" | "monthly" | "yearly">("weekly");
  const [report, setReport] = useState<PurchaseReport | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(() => {
    setLoading(true);
    api.get(`/api/stock/report?period=${period}`)
      .then((r) => { setReport(r.data); onReportReady(r.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period, onReportReady]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const tabs = [
    { key: "weekly",  label: "Weekly"  },
    { key: "monthly", label: "Monthly" },
    { key: "yearly",  label: "Yearly"  },
  ] as const;

  return (
    <div className="mb-6 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 pt-4 border-b border-gray-100 pb-3">
        <h2 className="text-sm sm:text-base font-semibold text-gray-800">Purchases Report</h2>
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setPeriod(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                period === t.key ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
        ) : report ? (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {[
                { label: "Total Spent",       value: fmt(report.totalSpent),              sub: "purchasing cost",  accent: "text-indigo-600" },
                { label: "Purchases Made",    value: String(report.totalPurchases),       sub: "restock events",   accent: "text-purple-600" },
                { label: "Units Restocked",   value: String(report.totalUnitsRestocked),  sub: "total units added", accent: "text-teal-600"  },
              ].map((kpi, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">{kpi.label}</p>
                  <p className={`text-base sm:text-lg font-bold mt-0.5 ${kpi.accent}`}>{kpi.value}</p>
                  <p className="text-xs text-gray-400">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Spending chart */}
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Spending Over Time</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={report.spendingByDay} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="amount" name="Spent" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top restocked products */}
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Most Restocked Products</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                      <th className="pb-2 font-medium w-8">#</th>
                      <th className="pb-2 font-medium">Product</th>
                      <th className="pb-2 font-medium hidden sm:table-cell">Category</th>
                      <th className="pb-2 font-medium text-right">Units</th>
                      <th className="pb-2 font-medium text-right">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topRestockedProducts.length === 0 ? (
                      <tr><td colSpan={5} className="py-4 text-center text-gray-400 text-xs">No data</td></tr>
                    ) : report.topRestockedProducts.map((p, i) => (
                      <tr key={p.productId} className="border-b border-gray-50">
                        <td className="py-2 text-gray-400 font-bold text-xs">{i + 1}</td>
                        <td className="py-2 font-medium text-gray-700 text-xs">{p.productName}</td>
                        <td className="py-2 text-gray-400 text-xs hidden sm:table-cell">{p.category}</td>
                        <td className="py-2 text-right text-gray-600 text-xs">{p.totalQty}</td>
                        <td className="py-2 text-right font-semibold text-indigo-600 text-xs">{fmt(p.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent purchases */}
            <div>
              <h3 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Recent Purchases</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Product</th>
                      <th className="pb-2 font-medium text-right">Qty</th>
                      <th className="pb-2 font-medium text-right hidden sm:table-cell">Unit Price</th>
                      <th className="pb-2 font-medium text-right">Total</th>
                      <th className="pb-2 font-medium hidden md:table-cell">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.recentPurchases.map((p, i) => (
                      <tr key={p.id} className={`border-b border-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                        <td className="py-2 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="py-2 font-medium text-gray-700 text-xs">{p.productName}</td>
                        <td className="py-2 text-right text-gray-600 text-xs">+{p.quantity}</td>
                        <td className="py-2 text-right text-gray-500 text-xs hidden sm:table-cell">{fmt(p.buyingPrice)}</td>
                        <td className="py-2 text-right font-semibold text-indigo-600 text-xs">{fmt(p.totalCost)}</td>
                        <td className="py-2 text-gray-400 text-xs hidden md:table-cell">{p.restockedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function ReportsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [activeTab, setActiveTab] = useState<"sales" | "purchases">("sales");
  const [currentSummary, setCurrentSummary] = useState<SummaryData | null>(null);
  const [currentPurchaseReport, setCurrentPurchaseReport] = useState<PurchaseReport | null>(null);
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [eligibility, setEligibility] = useState<{ eligible: boolean; hoursSinceSale: number } | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const [returnLoading, setReturnLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [returnSuccess, setReturnSuccess] = useState("");
  const [returnError, setReturnError] = useState("");

  const fetchSales = () => {
    api.get("/api/sales").then((res) => setSales(res.data)).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { fetchSales(); }, []);

  const filtered = sales.filter((s) => {
    const date = new Date(s.createdAt);
    if (fromDate && date < new Date(fromDate)) return false;
    if (toDate && date > new Date(toDate + "T23:59:59")) return false;
    return true;
  });

  const totalRevenue = filtered.reduce((sum, s) => sum + s.totalAmount, 0);

  const openReturn = async (sale: Sale) => {
    setReturnSale(sale); setReturnReason(""); setReturnError(""); setReturnSuccess(""); setShowConfirm(false);
    try {
      const res = await api.get(`/api/sales/${sale.id}/eligibility`);
      setEligibility({ eligible: res.data.eligible, hoursSinceSale: res.data.hoursSinceSale });
      const alreadyReturned: Record<string, number> = {};
      for (const ret of (res.data.sale.returns ?? [])) {
        for (const ri of ret.items) {
          alreadyReturned[ri.productId] = (alreadyReturned[ri.productId] ?? 0) + ri.quantity;
        }
      }
      setReturnItems(sale.items.map((si) => ({
        productId: si.productId,
        quantity: 0,
        maxQty: si.quantity - (alreadyReturned[si.productId] ?? 0),
        priceAtSale: si.priceAtSale,
        productName: si.product.name,
      })));
    } catch { setEligibility(null); }
  };

  const closeReturn = () => {
    setReturnSale(null); setEligibility(null); setReturnItems([]);
    setReturnReason(""); setReturnError(""); setShowConfirm(false);
  };

  const updateReturnQty = (productId: string, qty: number) =>
    setReturnItems((prev) => prev.map((ri) => ri.productId === productId ? { ...ri, quantity: qty } : ri));

  const selectedItems = returnItems.filter((ri) => ri.quantity > 0);
  const refundAmount = selectedItems.reduce((sum, ri) => sum + ri.priceAtSale * ri.quantity, 0);

  const doReturn = async () => {
    if (!returnSale || selectedItems.length === 0) return;
    setReturnLoading(true); setReturnError("");
    try {
      await api.post("/api/returns", {
        saleId: returnSale.id,
        items: selectedItems.map((ri) => ({ productId: ri.productId, quantity: ri.quantity })),
        reason: returnReason || undefined,
      });
      setShowConfirm(false);
      setReturnSuccess(`Return of ${fmt(refundAmount)} processed successfully.`);
      fetchSales();
      setTimeout(() => { closeReturn(); }, 2500);
    } catch (err) {
      setShowConfirm(false);
      const msg = axios.isAxiosError(err) ? err.response?.data?.message || "Return failed" : "Something went wrong";
      setReturnError(msg);
    } finally { setReturnLoading(false); }
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Page header */}
        <div className="flex items-start justify-between mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Reports</h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Sales, purchases and returns overview</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {activeTab === "sales" && currentSummary && (
              <>
                <button onClick={() => exportCSV(currentSummary)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
                  <Download className="w-4 h-4" />Sales CSV
                </button>
                <button onClick={() => exportPDF(currentSummary)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-sm font-medium transition-colors border border-rose-200">
                  <Download className="w-4 h-4" />Sales PDF
                </button>
              </>
            )}
            {activeTab === "purchases" && currentPurchaseReport && (
              <>
                <button onClick={() => exportPurchaseCSV(currentPurchaseReport)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
                  <Download className="w-4 h-4" />Purchases CSV
                </button>
                <button onClick={() => exportPurchasePDF(currentPurchaseReport)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-sm font-medium transition-colors border border-indigo-200">
                  <Download className="w-4 h-4" />Purchases PDF
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sales / Purchases tab toggle */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
          <button onClick={() => setActiveTab("sales")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "sales" ? "bg-white shadow text-gray-800" : "text-gray-500 hover:text-gray-700"}`}>
            Sales Report
          </button>
          <button onClick={() => setActiveTab("purchases")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "purchases" ? "bg-white shadow text-gray-800" : "text-gray-500 hover:text-gray-700"}`}>
            Purchases Report
          </button>
        </div>

        {/* Report sections */}
        {activeTab === "sales" && <SummarySection onSummaryReady={setCurrentSummary} />}
        {activeTab === "purchases" && <PurchasesSection onReportReady={setCurrentPurchaseReport} />}

        {/* Filters — only on sales tab */}
        {activeTab === "sales" && (
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 sm:gap-4 mb-5">
          <div className="flex gap-3">
            <div className="flex-1 sm:flex-none">
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
              </div>
            </div>
            <div className="flex-1 sm:flex-none">
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
              </div>
            </div>
          </div>
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(""); setToDate(""); }}
              className="text-sm text-gray-400 hover:text-rose-500 self-end pb-1">Clear filter</button>
          )}
          <div className="w-full sm:w-auto sm:ml-auto bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Total Revenue</p>
              <p className="text-lg font-bold text-rose-600">{fmt(totalRevenue)}</p>
            </div>
          </div>
        </div>
        )}

        {activeTab === "sales" && (loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
        ) : (
          <>
            {/* Desktop sales table */}
            <div className="hidden sm:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-left text-gray-500">
                      <th className="px-4 py-3 font-medium">Date &amp; Time</th>
                      <th className="px-4 py-3 font-medium">Cashier</th>
                      <th className="px-4 py-3 font-medium">Items</th>
                      <th className="px-4 py-3 font-medium">Products</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No sales found</td></tr>
                    ) : filtered.map((s) => {
                      const expired = hoursSince(s.createdAt) >= 24;
                      return (
                        <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(s.createdAt)}</td>
                          <td className="px-4 py-3 text-gray-700 font-medium">{s.cashier.name}</td>
                          <td className="px-4 py-3 text-gray-500">{s.items.reduce((sum, i) => sum + i.quantity, 0)} units</td>
                          <td className="px-4 py-3 text-gray-500 max-w-xs">
                            <div className="flex flex-wrap gap-1">
                              {s.items.map((item) => (
                                <span key={item.id} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                  {item.product.name} ×{item.quantity}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold text-rose-600">{fmt(s.totalAmount)}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => !expired && openReturn(s)} disabled={expired}
                              title={expired ? "Return window expired (24 hours)" : "Process return"}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${expired ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-rose-50 text-rose-600 hover:bg-rose-100"}`}>
                              <RotateCcw className="w-3.5 h-3.5" />Return
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {filtered.length === 0 ? (
                <div className="text-center text-gray-400 py-12">No sales found</div>
              ) : filtered.map((s) => {
                const expired = hoursSince(s.createdAt) >= 24;
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-xs text-gray-500">{fmtDateShort(s.createdAt)}</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{s.cashier.name}</p>
                      </div>
                      <span className="text-base font-bold text-rose-600">{fmt(s.totalAmount)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {s.items.map((item) => (
                        <span key={item.id} className="text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full font-medium">
                          {item.product.name} ×{item.quantity}
                        </span>
                      ))}
                    </div>
                    <button onClick={() => !expired && openReturn(s)} disabled={expired}
                      className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium ${expired ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-rose-50 text-rose-600 hover:bg-rose-100"}`}>
                      <RotateCcw className="w-4 h-4" />{expired ? "Return Expired" : "Process Return"}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ))}
      </div>

      {/* Return Modal */}
      {returnSale && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up sm:animate-none">
            <div className="drag-handle sm:hidden mt-3" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-base font-semibold text-gray-800">Process Return</h2>
              <button onClick={closeReturn} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {returnSuccess && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />{returnSuccess}
                </div>
              )}
              {returnError && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />{returnError}
                </div>
              )}
              {eligibility && !eligibility.eligible && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  Return window expired ({eligibility.hoursSinceSale.toFixed(1)}h ago)
                </div>
              )}
              <p className="text-xs text-gray-500">
                Original sale: <span className="font-medium text-gray-700">{fmtDate(returnSale.createdAt)}</span>
                {" · "}<span className="font-medium text-gray-700">{fmt(returnSale.totalAmount)}</span>
              </p>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Select items to return:</p>
                {returnItems.map((ri) => (
                  <div key={ri.productId} className={`flex items-center justify-between p-3 rounded-lg border ${ri.quantity > 0 ? "border-rose-200 bg-rose-50" : "border-gray-100 bg-gray-50"}`}>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{ri.productName}</p>
                      <p className="text-xs text-gray-400">{fmt(ri.priceAtSale)} each · max return {ri.maxQty}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => updateReturnQty(ri.productId, Math.max(0, ri.quantity - 1))}
                        disabled={ri.quantity === 0}
                        className="w-7 h-7 bg-gray-200 hover:bg-rose-100 rounded-full flex items-center justify-center disabled:opacity-40 font-bold text-lg leading-none">−</button>
                      <span className="text-sm font-semibold w-6 text-center">{ri.quantity}</span>
                      <button type="button" onClick={() => updateReturnQty(ri.productId, Math.min(ri.maxQty, ri.quantity + 1))}
                        disabled={ri.quantity >= ri.maxQty || ri.maxQty === 0}
                        className="w-7 h-7 bg-gray-200 hover:bg-rose-100 rounded-full flex items-center justify-center disabled:opacity-40 font-bold text-lg leading-none">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Defective, wrong item..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
              </div>
              {selectedItems.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-red-50 border border-red-100 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Refund Amount</span>
                  <span className="text-lg font-bold text-red-600">{fmt(refundAmount)}</span>
                </div>
              )}
              <div className="flex gap-3 pt-1 pb-2">
                <button onClick={closeReturn} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">Cancel</button>
                <button onClick={() => setShowConfirm(true)}
                  disabled={selectedItems.length === 0 || !eligibility?.eligible || returnLoading}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-2.5 rounded-lg text-sm font-medium">
                  Confirm Return
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm popup */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60]">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-6 animate-slide-up sm:animate-none">
            <div className="drag-handle sm:hidden mb-1" />
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-red-100 p-2 rounded-lg"><RotateCcw className="w-5 h-5 text-red-500" /></div>
              <h2 className="text-base font-semibold text-gray-800">Confirm Return of {fmt(refundAmount)}?</h2>
            </div>
            <p className="text-gray-500 text-sm mb-5 leading-relaxed">
              This will restore <span className="font-semibold text-gray-700">{selectedItems.reduce((s, i) => s + i.quantity, 0)} item(s)</span> to
              stock and reduce revenue by <span className="font-semibold text-red-600">{fmt(refundAmount)}</span>. Cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">Go Back</button>
              <button onClick={doReturn} disabled={returnLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-4 py-2.5 rounded-lg text-sm font-medium">
                {returnLoading ? "Processing..." : "Yes, Process Return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
