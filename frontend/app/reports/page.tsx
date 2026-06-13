"use client";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { DollarSign, Calendar } from "lucide-react";

interface SaleItem { id: string; product: { name: string }; quantity: number; priceAtSale: number; }
interface Sale { id: string; createdAt: string; totalAmount: number; cashier: { name: string }; items: SaleItem[]; }

export default function ReportsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    api.get("/api/sales").then((res) => setSales(res.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = sales.filter((s) => {
    const date = new Date(s.createdAt);
    if (fromDate && date < new Date(fromDate)) return false;
    if (toDate && date > new Date(toDate + "T23:59:59")) return false;
    return true;
  });

  const totalRevenue = filtered.reduce((sum, s) => sum + s.totalAmount, 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 })
      .format(n).replace("ETB", "Birr");

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const fmtDateShort = (d: string) =>
    new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Sales Reports</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">View and filter all past transactions</p>
        </div>

        {/* Filters + summary — stack on mobile */}
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
              className="text-sm text-gray-400 hover:text-rose-500 transition-colors self-end pb-1">
              Clear filter
            </button>
          )}

          {/* Revenue card — full width on mobile */}
          <div className="w-full sm:w-auto sm:ml-auto bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Total Revenue</p>
              <p className="text-lg font-bold text-rose-600">{fmt(totalRevenue)}</p>
            </div>
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
                      <th className="px-4 py-3 font-medium">Date &amp; Time</th>
                      <th className="px-4 py-3 font-medium">Cashier</th>
                      <th className="px-4 py-3 font-medium">Items</th>
                      <th className="px-4 py-3 font-medium">Products</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">No sales found</td></tr>
                    ) : (
                      filtered.map((s) => (
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {filtered.length === 0 ? (
                <div className="text-center text-gray-400 py-12">No sales found</div>
              ) : (
                filtered.map((s) => (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-xs text-gray-500">{fmtDateShort(s.createdAt)}</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{s.cashier.name}</p>
                      </div>
                      <span className="text-base font-bold text-rose-600">{fmt(s.totalAmount)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {s.items.map((item) => (
                        <span key={item.id} className="text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full font-medium">
                          {item.product.name} ×{item.quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
