"use client";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, ShoppingBag, AlertTriangle, DollarSign, Clock } from "lucide-react";

interface ExpiringProduct {
  id: string; name: string; expiryDate: string; stock: number; category: { name: string };
}

interface PnLData {
  totalSpent: number; totalEarned: number; netProfit: number; isLoss: boolean;
}

interface DashboardData {
  totalRevenue: number;
  totalReturnsAmount: number;
  totalReturnsCount: number;
  totalSalesToday: number;
  revenueToday: number;
  returnsTodayAmount: number;
  returnsTodayCount: number;
  lowStockProducts: { id: string; name: string; stock: number; lowStockAlert: number; category: { name: string } }[];
  expiringProducts: ExpiringProduct[];
  topProducts: { product: { id: string; name: string } | null; totalQuantity: number }[];
  revenueLastDays: { date: string; revenue: number }[];
  pnl: { weekly: PnLData; monthly: PnLData; yearly: PnLData };
}

function StatCard({ title, value, icon: Icon, color, subtitle, subtitleRed }: {
  title: string; value: string; icon: React.ElementType; color: string; subtitle?: string; subtitleRed?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-gray-500 font-medium leading-tight">{title}</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-800 mt-0.5 sm:mt-1 truncate">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">{subtitle}</p>}
          {subtitleRed && <p className="text-xs text-red-400 mt-0.5 hidden sm:block">{subtitleRed}</p>}
        </div>
        <div className={`p-2 sm:p-2.5 rounded-lg ${color} flex-shrink-0 ml-2`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pnlPeriod, setPnlPeriod] = useState<"weekly" | "monthly" | "yearly">("weekly");

  const fetchData = () => {
    setLoading(true);
    setError(false);
    api.get("/api/dashboard")
      .then((res) => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Silently wake up Render server
    fetch("https://edo-cosmo.onrender.com/health").catch(() => {});
    fetchData();
  }, []);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 })
      .format(n).replace("ETB", "Birr");

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const fmtExpiryDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const daysUntilExpiry = (d: string) =>
    Math.ceil((new Date(d).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  const pnlData = data?.pnl[pnlPeriod];

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Overview of your shop&apos;s performance</p>
        </div>

        {loading ? (
          /* ── Skeleton ── */
          <div className="animate-pulse space-y-4">
            {/* Stat cards skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-gray-200 rounded-xl h-24 sm:h-28" />
              ))}
            </div>
            {/* Chart skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
              <div className="lg:col-span-2 bg-gray-200 rounded-xl h-64" />
              <div className="bg-gray-200 rounded-xl h-64" />
            </div>
            {/* Table skeleton */}
            <div className="bg-gray-200 rounded-xl h-40" />
          </div>
        ) : error ? (
          /* ── Error state ── */
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-4">
            <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <p className="text-gray-700 font-semibold text-sm">Could not load dashboard</p>
              <p className="text-gray-400 text-xs mt-1">The server may be waking up. Please wait 30 seconds and try again.</p>
            </div>
            <button onClick={fetchData}
              className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium rounded-lg transition-colors">
              Retry
            </button>
          </div>
        ) : data ? (
          <>
            {/* Stat cards — 4 regular + 1 P&L compact card */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-5">
              <StatCard title="Net Revenue" value={fmt(data.totalRevenue)} icon={DollarSign} color="bg-rose-500"
                subtitle="All time (after returns)"
                subtitleRed={data.totalReturnsAmount > 0 ? `− ${fmt(data.totalReturnsAmount)} returned` : undefined} />
              <StatCard title="Today's Revenue" value={fmt(data.revenueToday)} icon={TrendingUp} color="bg-pink-500"
                subtitle="Net today"
                subtitleRed={data.returnsTodayAmount > 0 ? `− ${fmt(data.returnsTodayAmount)} returned` : undefined} />
              <StatCard title="Sales Today"  value={String(data.totalSalesToday)}         icon={ShoppingBag}   color="bg-purple-500" subtitle="Transactions" />
              <StatCard title="Low Stock"    value={String(data.lowStockProducts.length)} icon={AlertTriangle} color="bg-orange-500" subtitle="Need restock" />

              {/* P&L compact card — spans 2 cols on mobile, 1 col on desktop */}
              {pnlData && (
                <div className={`col-span-2 lg:col-span-1 rounded-xl p-3 sm:p-4 shadow-sm flex flex-col justify-between ${
                  pnlData.netProfit > 0
                    ? "bg-gradient-to-br from-emerald-500 to-green-600"
                    : pnlData.netProfit < 0
                    ? "bg-gradient-to-br from-rose-600 to-red-700"
                    : "bg-gradient-to-br from-amber-400 to-orange-500"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-white/80 text-xs font-semibold uppercase tracking-wide">P&amp;L</span>
                    <div className="flex gap-0.5">
                      {(["weekly", "monthly", "yearly"] as const).map((p) => (
                        <button key={p} onClick={() => setPnlPeriod(p)}
                          className={`w-6 h-5 rounded text-[10px] font-bold transition-colors ${pnlPeriod === p ? "bg-white text-gray-800" : "bg-white/20 text-white hover:bg-white/30"}`}>
                          {p[0].toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="my-1 sm:my-2">
                    <p className="text-lg sm:text-2xl font-bold text-white leading-tight truncate">
                      {pnlData.isLoss ? "−" : "+"}{fmt(Math.abs(pnlData.netProfit))}
                    </p>
                  </div>
                  <p className={`text-xs font-semibold ${pnlData.netProfit < 0 ? "text-red-200" : pnlData.netProfit === 0 ? "text-orange-100" : "text-green-100"}`}>
                    {pnlData.netProfit > 0 ? "▲ Net Profit" : pnlData.netProfit < 0 ? "▼ Net Loss" : "◆ Break Even"}
                  </p>
                </div>
              )}
            </div>

            {/* Chart + Top products */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm">
                <h2 className="text-sm sm:text-base font-semibold text-gray-700 mb-3 sm:mb-4">Revenue — Last 7 Days</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.revenueLastDays}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [fmt(v), "Revenue"]} labelFormatter={fmtDate} />
                    <Line type="monotone" dataKey="revenue" stroke="#f43f5e" strokeWidth={2.5}
                      dot={{ fill: "#f43f5e", r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm">
                <h2 className="text-sm sm:text-base font-semibold text-gray-700 mb-3 sm:mb-4">Top 5 Products</h2>
                {data.topProducts.length === 0 ? (
                  <p className="text-sm text-gray-400">No sales data yet</p>
                ) : (
                  <div className="space-y-3">
                    {data.topProducts.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 sm:gap-3">
                        <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                            {item.product?.name ?? "Unknown"}
                          </p>
                          <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                            <div className="h-1.5 bg-rose-400 rounded-full"
                              style={{ width: `${Math.min(100, (item.totalQuantity / (data.topProducts[0]?.totalQuantity || 1)) * 100)}%` }} />
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">{item.totalQuantity} sold</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Expiring Soon */}
            {data.expiringProducts.length > 0 && (
              <div className="bg-white rounded-xl border border-amber-100 p-4 sm:p-5 shadow-sm mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                  <h2 className="text-sm sm:text-base font-semibold text-gray-700">Expiring Soon</h2>
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-2 font-medium">Product</th><th className="pb-2 font-medium">Category</th>
                      <th className="pb-2 font-medium">Expiry Date</th><th className="pb-2 font-medium">Stock</th>
                    </tr></thead>
                    <tbody>
                      {data.expiringProducts.map((p) => {
                        const days = daysUntilExpiry(p.expiryDate);
                        const isUrgent = days <= 30;
                        return (
                          <tr key={p.id} className="border-b border-gray-50">
                            <td className="py-2.5 font-medium text-gray-700">{p.name}</td>
                            <td className="py-2.5 text-gray-500">{p.category.name}</td>
                            <td className="py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isUrgent ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
                                {fmtExpiryDate(p.expiryDate)} ({days}d)
                              </span>
                            </td>
                            <td className="py-2.5 text-gray-500">{p.stock}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="sm:hidden space-y-2">
                  {data.expiringProducts.map((p) => {
                    const days = daysUntilExpiry(p.expiryDate);
                    return (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                        <div><p className="text-sm font-semibold text-gray-800">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.category.name} · Stock: {p.stock}</p></div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${days <= 30 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>{days}d left</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Low Stock */}
            {data.lowStockProducts.length > 0 && (
              <div className="bg-white rounded-xl border border-orange-100 p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                  <h2 className="text-sm sm:text-base font-semibold text-gray-700">Low Stock Warning</h2>
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-2 font-medium">Product</th><th className="pb-2 font-medium">Category</th>
                      <th className="pb-2 font-medium">Stock</th><th className="pb-2 font-medium">Threshold</th>
                    </tr></thead>
                    <tbody>
                      {data.lowStockProducts.map((p) => (
                        <tr key={p.id} className="border-b border-gray-50">
                          <td className="py-2.5 font-medium text-gray-700">{p.name}</td>
                          <td className="py-2.5 text-gray-500">{p.category.name}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.stock === 0 ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"}`}>
                              {p.stock} left
                            </span>
                          </td>
                          <td className="py-2.5 text-gray-500">{p.lowStockAlert}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="sm:hidden space-y-2">
                  {data.lowStockProducts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div><p className="text-sm font-semibold text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.category.name}</p></div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${p.stock === 0 ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"}`}>
                        {p.stock} left
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </Layout>
  );
}
