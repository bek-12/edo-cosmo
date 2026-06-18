"use client";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { DollarSign, Calendar, RotateCcw, X, AlertTriangle, CheckCircle } from "lucide-react";
import axios from "axios";

interface SaleItem {
  id: string;
  productId: string;
  product: { name: string };
  quantity: number;
  priceAtSale: number;
}

interface ReturnItem {
  productId: string;
  quantity: number;
}

interface SaleReturn {
  items: { productId: string; quantity: number }[];
}

interface Sale {
  id: string;
  createdAt: string;
  totalAmount: number;
  cashier: { name: string };
  items: SaleItem[];
  returns?: SaleReturn[];
}

export default function ReportsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Return modal state
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [eligibility, setEligibility] = useState<{ eligible: boolean; hoursSinceSale: number } | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const [returnLoading, setReturnLoading] = useState(false);

  // Confirm popup
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

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 })
      .format(n).replace("ETB", "Birr");

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const fmtDateShort = (d: string) =>
    new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const hoursSince = (d: string) =>
    (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60);

  // Open return modal
  const openReturn = async (sale: Sale) => {
    setReturnSale(sale);
    setReturnReason("");
    setReturnError("");
    setReturnSuccess("");
    setShowConfirm(false);

    // Fetch eligibility (also returns already-returned quantities)
    try {
      const res = await api.get(`/api/sales/${sale.id}/eligibility`);
      setEligibility({ eligible: res.data.eligible, hoursSinceSale: res.data.hoursSinceSale });

      // Build already-returned map
      const alreadyReturned: Record<string, number> = {};
      for (const ret of (res.data.sale.returns ?? [])) {
        for (const ri of ret.items) {
          alreadyReturned[ri.productId] = (alreadyReturned[ri.productId] ?? 0) + ri.quantity;
        }
      }

      // Init return items with 0 quantity
      setReturnItems(
        sale.items.map((si) => ({
          productId: si.productId,
          quantity: 0,
          maxQty: si.quantity - (alreadyReturned[si.productId] ?? 0),
        } as ReturnItem & { maxQty: number }))
      );
    } catch { setEligibility(null); }
  };

  const closeReturn = () => {
    setReturnSale(null);
    setEligibility(null);
    setReturnItems([]);
    setReturnReason("");
    setReturnError("");
    setShowConfirm(false);
  };

  const updateReturnQty = (productId: string, qty: number) => {
    setReturnItems((prev) =>
      prev.map((ri) => ri.productId === productId ? { ...ri, quantity: qty } : ri)
    );
  };

  const selectedItems = returnItems.filter((ri) => ri.quantity > 0);

  const refundAmount = selectedItems.reduce((sum, ri) => {
    const saleItem = returnSale?.items.find((si) => si.productId === ri.productId);
    return sum + (saleItem?.priceAtSale ?? 0) * ri.quantity;
  }, 0);

  const doReturn = async () => {
    if (!returnSale || selectedItems.length === 0) return;
    setReturnLoading(true);
    setReturnError("");
    try {
      await api.post("/api/returns", {
        saleId: returnSale.id,
        items: selectedItems.map((ri) => ({ productId: ri.productId, quantity: ri.quantity })),
        reason: returnReason || undefined,
      });
      setShowConfirm(false);
      setReturnSuccess(`Return of ${fmt(refundAmount)} processed successfully.`);
      fetchSales(); // refresh
      setTimeout(() => { closeReturn(); }, 2500);
    } catch (err) {
      setShowConfirm(false);
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || "Return failed"
        : "Something went wrong";
      setReturnError(msg);
    } finally {
      setReturnLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Sales Reports</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">View, filter and process returns</p>
        </div>

        {/* Filters + summary */}
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
                      <th className="px-4 py-3 font-medium">Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No sales found</td></tr>
                    ) : (
                      filtered.map((s) => {
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
                              <button
                                onClick={() => !expired && openReturn(s)}
                                disabled={expired}
                                title={expired ? "Return window expired (24 hours)" : "Process return"}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  expired
                                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                    : "bg-rose-50 text-rose-600 hover:bg-rose-100"
                                }`}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Return
                              </button>
                            </td>
                          </tr>
                        );
                      })
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
                filtered.map((s) => {
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
                      <button
                        onClick={() => !expired && openReturn(s)}
                        disabled={expired}
                        title={expired ? "Return window expired (24 hours)" : undefined}
                        className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                          expired
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-rose-50 text-rose-600 hover:bg-rose-100"
                        }`}
                      >
                        <RotateCcw className="w-4 h-4" />
                        {expired ? "Return Expired" : "Process Return"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Return Modal ── */}
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
                  Return window expired ({eligibility.hoursSinceSale.toFixed(1)} hours ago)
                </div>
              )}

              <p className="text-xs text-gray-500">
                Original sale: <span className="font-medium text-gray-700">{fmtDate(returnSale.createdAt)}</span>
                {" · "}<span className="font-medium text-gray-700">{fmt(returnSale.totalAmount)}</span>
              </p>

              {/* Items checklist */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Select items to return:</p>
                {returnSale.items.map((si) => {
                  const ri = returnItems.find((r) => r.productId === si.productId);
                  const maxQty = (ri as ReturnItem & { maxQty?: number })?.maxQty ?? si.quantity;
                  const qty = ri?.quantity ?? 0;
                  return (
                    <div key={si.id} className={`flex items-center justify-between p-3 rounded-lg border ${qty > 0 ? "border-rose-200 bg-rose-50" : "border-gray-100 bg-gray-50"}`}>
                      <div>
                        <p className="text-sm font-medium text-gray-700">{si.product.name}</p>
                        <p className="text-xs text-gray-400">
                          {fmt(si.priceAtSale)} each · sold {si.quantity} · max return {maxQty}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateReturnQty(si.productId, Math.max(0, qty - 1))}
                          disabled={qty === 0}
                          className="w-7 h-7 bg-gray-200 hover:bg-rose-100 rounded-full flex items-center justify-center disabled:opacity-40 text-lg leading-none">−</button>
                        <span className="text-sm font-semibold w-6 text-center">{qty}</span>
                        <button onClick={() => updateReturnQty(si.productId, Math.min(maxQty, qty + 1))}
                          disabled={qty >= maxQty || maxQty === 0}
                          className="w-7 h-7 bg-gray-200 hover:bg-rose-100 rounded-full flex items-center justify-center disabled:opacity-40 text-lg leading-none">+</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for return <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Defective, wrong item, customer changed mind..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
              </div>

              {/* Refund total */}
              {selectedItems.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-red-50 border border-red-100 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Refund Amount</span>
                  <span className="text-lg font-bold text-red-600">{fmt(refundAmount)}</span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-1 pb-2">
                <button onClick={closeReturn}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={selectedItems.length === 0 || !eligibility?.eligible || returnLoading}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                  Confirm Return
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Return popup ── */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60]">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-6 animate-slide-up sm:animate-none">
            <div className="drag-handle sm:hidden mb-1" />
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-red-100 p-2 rounded-lg flex-shrink-0">
                <RotateCcw className="w-5 h-5 text-red-500" />
              </div>
              <h2 className="text-base font-semibold text-gray-800">
                Confirm Return of {fmt(refundAmount)}?
              </h2>
            </div>
            <p className="text-gray-500 text-sm mb-5 leading-relaxed">
              This will restore{" "}
              <span className="font-semibold text-gray-700">
                {selectedItems.reduce((s, i) => s + i.quantity, 0)} item(s)
              </span>{" "}
              to inventory stock and reduce total revenue by{" "}
              <span className="font-semibold text-red-600">{fmt(refundAmount)}</span>.
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">
                Go Back
              </button>
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
