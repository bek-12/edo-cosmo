"use client";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { PackagePlus } from "lucide-react";

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

export default function StockPage() {
  const [purchases, setPurchases] = useState<StockPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/stock/purchases")
      .then((res) => setPurchases(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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

  const totalInvested = purchases.reduce((sum, p) => sum + p.totalCost, 0);

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Stock History</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">All restock and purchase records</p>
        </div>

        {/* Summary card */}
        <div className="mb-5 bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4 flex items-center gap-4 w-full sm:w-auto sm:inline-flex">
          <div className="bg-indigo-100 p-2.5 rounded-lg">
            <PackagePlus className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Invested</p>
            <p className="text-xl font-bold text-indigo-600">{fmt(totalInvested)}</p>
          </div>
        </div>

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
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
