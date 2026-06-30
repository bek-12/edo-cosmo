"use client";
import { useEffect, useState, useCallback } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { PackagePlus, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";

/* ── Types ── */
interface StockPurchase {
  id: string;
  createdAt: string;
  quantity: number;
  buyingPrice: number;
  totalCost: number;
  note: string | null;
  product: { id: string; name: string; category: { name: string } };
  cashier: { id: string; name: string };
}

interface PurchasesResponse {
  purchases: StockPurchase[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface TopRestocked {
  productId: string;
  productName: string;
  category: string;
  totalQty: number;
  totalCost: number;
  restockCount: number;
}

interface StockStats {
  totalInvested: number;
  topRestocked: TopRestocked[];
}

const LIMIT = 15;

/* ── Helpers ── */
const fmt = (n: number) =>
  new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 })
    .format(n).replace("ETB", "Birr");

const fmtDate = (d: string) =>
  new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

const fmtDateShort = (d: string) =>
  new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/* ── Pagination Component ── */
function Pagination({ page, totalPages, total, limit, onChange }: {
  page: number; totalPages: number; total: number; limit: number; onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  // Build page number array with ellipsis
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-white rounded-b-xl">
      <p className="text-sm text-gray-500">
        Showing <span className="font-medium text-gray-700">{from}–{to}</span> of{" "}
        <span className="font-medium text-gray-700">{total}</span> records
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-sm">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors ${
                p === page
                  ? "bg-gray-800 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function StockPage() {
  const [data, setData]         = useState<PurchasesResponse | null>(null);
  const [stats, setStats]       = useState<StockStats | null>(null);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchPurchases = useCallback((p: number) => {
    setLoading(true);
    api.get(`/api/stock/purchases?page=${p}&limit=${LIMIT}`)
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.get("/api/stock/stats")
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => { fetchPurchases(page); }, [page, fetchPurchases]);

  const handlePageChange = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const purchases   = data?.purchases ?? [];
  const totalPages  = data?.totalPages ?? 1;
  const total       = data?.total ?? 0;

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Stock History</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">All restock and purchase records</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Total Invested */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="bg-indigo-100 p-2.5 rounded-lg flex-shrink-0">
              <PackagePlus className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Invested</p>
              <p className="text-2xl font-bold text-indigo-600 mt-0.5">
                {statsLoading ? "—" : fmt(stats?.totalInvested ?? 0)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {statsLoading ? "" : (
                  <>
                    <span className="font-semibold text-gray-600">
                      {stats?.topRestocked.reduce((s, i) => s + i.totalQty, 0) ?? 0}
                    </span> total items restocked
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Most Restocked Items */}
          <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-rose-500" />
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Most Restocked</p>
              </div>
              <span className="text-xs text-gray-400">Top 5</span>
            </div>
            {statsLoading ? (
              <div className="text-sm text-gray-400">Loading...</div>
            ) : !stats?.topRestocked.length ? (
              <div className="text-sm text-gray-400">No data yet</div>
            ) : (
              <div className="space-y-2">
                {stats.topRestocked.map((item, i) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  return (
                    <div key={item.productId} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base w-5 flex-shrink-0">{medals[i] ?? `${i + 1}`}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                          <p className="text-xs text-gray-400">{item.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                          +{item.totalQty} units
                        </span>
                        <span className="text-xs text-gray-400">{item.restockCount}×</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-left text-gray-500">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Qty Added</th>
                      <th className="px-4 py-3 font-medium">Buying Price</th>
                      <th className="px-4 py-3 font-medium">Total Cost</th>
                      <th className="px-4 py-3 font-medium">Note</th>
                      <th className="px-4 py-3 font-medium">Added By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No restock records yet</td></tr>
                    ) : purchases.map((p) => (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{p.product.name}</td>
                        <td className="px-4 py-3 text-gray-500">{p.product.category.name}</td>
                        <td className="px-4 py-3">
                          <span className="bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-full text-xs">+{p.quantity}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{fmt(p.buyingPrice)}</td>
                        <td className="px-4 py-3 font-bold text-indigo-600">{fmt(p.totalCost)}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{p.note || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-gray-500">{p.cashier.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onChange={handlePageChange} />
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {purchases.length === 0 ? (
                <div className="text-center text-gray-400 py-12">No restock records yet</div>
              ) : purchases.map((p) => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between mb-1.5">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{p.product.name}</p>
                      <p className="text-xs text-gray-400">{p.product.category.name} · {fmtDateShort(p.createdAt)}</p>
                    </div>
                    <span className="text-base font-bold text-indigo-600">{fmt(p.totalCost)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="bg-indigo-50 text-indigo-600 text-xs font-semibold px-2 py-0.5 rounded-full">+{p.quantity} units</span>
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{fmt(p.buyingPrice)} each</span>
                    <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">by {p.cashier.name}</span>
                  </div>
                  {p.note && <p className="text-xs text-gray-400 mt-2 italic">{p.note}</p>}
                </div>
              ))}
              {/* Mobile pagination */}
              <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onChange={handlePageChange} />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
