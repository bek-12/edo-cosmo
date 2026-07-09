"use client";
import { useEffect, useState, useCallback } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { Search, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ── Types ── */
interface GainPeriod { label: string; gain: number; revenue: number; cost: number; }
interface TopProfitProduct {
  productId: string; productName: string; unitsSold: number;
  totalGain: number; totalRevenue: number; marginPercent: number;
}
interface EarningsReport {
  period: string; totalGain: number; totalRevenue: number; totalCost: number;
  averageMarginPercent: number; gainByPeriod: GainPeriod[]; topProfitableProducts: TopProfitProduct[];
}

/* ── Helpers ── */
const fmt = (n: number) =>
  new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 })
    .format(n).replace("ETB", "Birr");

function exportCSV(report: EarningsReport) {
  const rows = [
    ["Period", report.period],
    ["Total Gain", report.totalGain],
    ["Total Revenue", report.totalRevenue],
    ["Total Cost", report.totalCost],
    ["Average Margin", `${report.averageMarginPercent}%`],
    [],
    ["Rank", "Product", "Units Sold", "Total Gain", "Margin %"],
    ...report.topProfitableProducts.map((p, i) => [i + 1, p.productName, p.unitsSold, p.totalGain, `${p.marginPercent}%`]),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `earnings-${report.period}.csv`; a.click();
  URL.revokeObjectURL(url);
}

async function exportPDF(report: EarningsReport) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const GREEN = [5, 150, 105]    as [number, number, number];
  const DARK  = [17, 24, 39]     as [number, number, number];
  const GRAY  = [107, 114, 128]  as [number, number, number];
  const periodLabel = report.period.charAt(0).toUpperCase() + report.period.slice(1);
  const now = new Date().toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  let y = 18;
  doc.setFillColor(...GREEN); doc.rect(0, 0, 210, 14, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("Cosmetics Shop — My Earnings Report", 14, 9.5);
  doc.setTextColor(...DARK); doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text(`${periodLabel} Earnings`, 14, y + 6); y += 14;
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
  doc.text(`Generated: ${now}`, 14, y); y += 10;
  const kpis = [
    { label: "Total Gain",    value: fmt(report.totalGain) },
    { label: "Total Revenue", value: fmt(report.totalRevenue) },
    { label: "Avg Margin",    value: `${report.averageMarginPercent}%` },
  ];
  const boxW = 58, boxH = 16, gap = 3, startX = 14;
  kpis.forEach((kpi, i) => {
    const x = startX + i * (boxW + gap);
    doc.setFillColor(240, 253, 244); doc.roundedRect(x, y, boxW, boxH, 2, 2, "F");
    doc.setDrawColor(167, 243, 208); doc.roundedRect(x, y, boxW, boxH, 2, 2, "S");
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
    doc.text(kpi.label.toUpperCase(), x + 3, y + 5);
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(5, 150, 105);
    doc.text(kpi.value, x + 3, y + 12);
  });
  y += boxH + 10;
  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK);
  doc.text("Most Profitable Products", 14, y); y += 4;
  autoTable(doc, {
    startY: y,
    head: [["#", "Product", "Units", "Total Gain", "Margin %"]],
    body: report.topProfitableProducts.map((p, i) => [String(i + 1), p.productName, String(p.unitsSold), fmt(p.totalGain), `${p.marginPercent}%`]),
    theme: "striped", styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: GREEN, textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" }, 1: { cellWidth: 80 },
      2: { cellWidth: 20, halign: "center" }, 3: { cellWidth: 40, halign: "right" }, 4: { cellWidth: 30, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });
  doc.save(`earnings-${report.period}-${new Date().toISOString().split("T")[0]}.pdf`);
}

/* ── Main Page ── */
export default function EarningsPage() {
  const [period, setPeriod]   = useState<"weekly" | "monthly" | "yearly">("weekly");
  const [report, setReport]   = useState<EarningsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState("");

  const fetchReport = useCallback(() => {
    setLoading(true);
    api.get(`/api/reports/profit?period=${period}`)
      .then((r) => setReport(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => { fetchReport(); }, [fetchReport]);
  useEffect(() => { setSearch(""); }, [period]);

  const periodLabel = period === "weekly" ? "week" : period === "monthly" ? "month" : "year";

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-800">My Earnings</h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Your real take-home profit from completed sales</p>
          </div>
          {report && (
            <div className="flex items-center gap-2 mt-1">
              <button onClick={() => exportCSV(report)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
                <Download className="w-4 h-4" />Earnings CSV
              </button>
              <button onClick={() => exportPDF(report)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-sm font-medium transition-colors border border-emerald-200">
                <Download className="w-4 h-4" />Earnings PDF
              </button>
            </div>
          )}
        </div>

        {/* Period toggle */}
        <div className="flex gap-1 mb-5">
          {(["weekly", "monthly", "yearly"] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                period === p ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-emerald-300 border-t-emerald-500 rounded-full animate-spin" />
              <span className="text-sm">Loading earnings...</span>
            </div>
          </div>
        ) : report ? (
          <div className="space-y-4">
            {/* Hero card */}
            <div className={`rounded-xl p-5 sm:p-6 shadow-sm ${report.totalGain > 0 ? "bg-gradient-to-br from-emerald-500 to-green-600" : "bg-gradient-to-br from-gray-400 to-gray-500"}`}>
              <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wide mb-1">Your Take-Home Earnings</p>
              <p className="text-white text-3xl sm:text-4xl font-bold mb-1">{fmt(report.totalGain)}</p>
              <p className="text-emerald-100 text-sm mb-3">You gained this {periodLabel} from completed sales.</p>
              <p className="text-white/80 text-xs">Average margin: <span className="font-bold text-white">{report.averageMarginPercent}%</span></p>
              <p className="text-emerald-100/70 text-xs mt-3 leading-relaxed">
                This is your real take-home profit after product costs — what you can safely use for rent, restocking, or personal expenses.
              </p>
            </div>

            {/* 3 stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "Total Revenue",  value: fmt(report.totalRevenue), sub: "from sales",                   accent: "text-gray-800" },
                { label: "Total Cost",     value: fmt(report.totalCost),    sub: "buying price of sold items",   accent: "text-gray-800" },
                { label: "Avg Margin",     value: `${report.averageMarginPercent}%`, sub: "gain ÷ revenue",      accent: "text-emerald-600" },
              ].map((kpi, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4">
                  <p className="text-xs text-gray-500">{kpi.label}</p>
                  <p className={`text-lg font-bold mt-0.5 ${kpi.accent}`}>{kpi.value}</p>
                  <p className="text-xs text-gray-400">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Most profitable products */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Most Profitable Products</h3>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by product name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-left text-gray-500">
                      <th className="px-4 py-3 font-medium w-8">#</th>
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium text-right">Units</th>
                      <th className="px-4 py-3 font-medium text-right">Gain</th>
                      <th className="px-4 py-3 font-medium text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const q = search.toLowerCase();
                      const filtered = search
                        ? report.topProfitableProducts.filter((p) => p.productName.toLowerCase().includes(q))
                        : report.topProfitableProducts;
                      return filtered.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                          {search ? `No products matching "${search}"` : "No sales data in this period"}
                        </td></tr>
                      ) : filtered.map((p, i) => (
                        <tr key={p.productId} className={`border-b border-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/40"}`}>
                          <td className="px-4 py-3 text-gray-400 font-bold text-xs">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-800 text-xs">{p.productName}</td>
                          <td className="px-4 py-3 text-right text-gray-600 text-xs">{p.unitsSold}</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600 text-xs">{fmt(p.totalGain)}</td>
                          <td className="px-4 py-3 text-right text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-semibold ${p.marginPercent >= 20 ? "bg-emerald-100 text-emerald-700" : p.marginPercent >= 10 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"}`}>
                              {p.marginPercent}%
                            </span>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-gray-400 leading-relaxed px-1">
              💡 <span className="font-medium text-gray-500">Note:</span> This is different from the P&amp;L card on your Dashboard. That one shows your cash flow (money in vs money out for restocking). This shows your actual profit margin from completed sales.
            </p>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
