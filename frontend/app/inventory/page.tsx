"use client";
import { useEffect, useState, useRef } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { Plus, Pencil, Trash2, X, AlertTriangle, Search } from "lucide-react";
import axios from "axios";

interface Category { id: string; name: string; }
interface Product {
  id: string; name: string; categoryId: string; category: Category;
  buyingPrice: number; sellingPrice: number; stock: number;
  lowStockAlert: number; expiryDate: string | null;
}
interface ProductForm {
  name: string; categoryId: string; categoryInputText: string;
  buyingPrice: string; sellingPrice: string; stock: string; expiryDate: string;
}

const emptyForm: ProductForm = {
  name: "", categoryId: "", categoryInputText: "",
  buyingPrice: "", sellingPrice: "", stock: "", expiryDate: "",
};

function CategoryCombo({ categories, value, inputText, onChange }: {
  categories: Category[]; value: string; inputText: string;
  onChange: (id: string, text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = categories.filter((c) => c.name.toLowerCase().includes(inputText.toLowerCase()));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = (text: string) => {
    const match = categories.find((c) => c.name.toLowerCase() === text.toLowerCase());
    onChange(match ? match.id : "", text);
    setOpen(true);
  };

  const exactMatch = categories.find((c) => c.name.toLowerCase() === inputText.toLowerCase());
  const showCreate = inputText.trim() !== "" && !exactMatch;

  return (
    <div ref={ref} className="relative">
      <input type="text" value={inputText} onChange={(e) => handleInput(e.target.value)}
        onFocus={() => setOpen(true)} placeholder="Type or select a category..."
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
        required={!value} autoComplete="off" />
      <input type="hidden" value={value} required />
      {open && (inputText.trim() !== "" || filtered.length > 0) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((c) => (
            <button key={c.id} type="button" onMouseDown={() => { onChange(c.id, c.name); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-rose-50 hover:text-rose-600">{c.name}</button>
          ))}
          {showCreate && (
            <button type="button" onMouseDown={() => { onChange("__CREATE__", inputText.trim()); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-sm text-rose-600 font-medium hover:bg-rose-50 border-t border-gray-100">
              + Create &quot;{inputText.trim()}&quot;
            </button>
          )}
          {filtered.length === 0 && !showCreate && (
            <p className="px-3 py-2 text-sm text-gray-400">No categories found</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showLossConfirm, setShowLossConfirm] = useState(false);
  const [showNoExpiryConfirm, setShowNoExpiryConfirm] = useState(false);

  const fetchData = async () => {
    try {
      const [pRes, cRes] = await Promise.all([api.get("/api/products"), api.get("/api/categories")]);
      setProducts(pRes.data);
      setCategories(cRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditProduct(null); setForm(emptyForm); setError(""); setShowModal(true); };
  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({ name: p.name, categoryId: p.categoryId, categoryInputText: p.category.name,
      buyingPrice: String(p.buyingPrice), sellingPrice: String(p.sellingPrice),
      stock: String(p.stock), expiryDate: p.expiryDate ? p.expiryDate.split("T")[0] : "" });
    setError(""); setShowModal(true);
  };

  const resolveCategory = async (f: ProductForm): Promise<string | null> => {
    if (f.categoryId && f.categoryId !== "__CREATE__") return f.categoryId;
    try {
      const res = await api.post("/api/categories", { name: f.categoryInputText });
      setCategories((prev) => {
        if (prev.find((c) => c.id === res.data.id)) return prev;
        return [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name));
      });
      return res.data.id;
    } catch { return null; }
  };

  const doSave = async () => {
    setSaving(true); setError("");
    try {
      const categoryId = await resolveCategory(form);
      if (!categoryId) { setError("Could not resolve category. Please try again."); setSaving(false); return; }
      const payload = { name: form.name, categoryId, buyingPrice: Number(form.buyingPrice),
        sellingPrice: Number(form.sellingPrice), stock: Number(form.stock), expiryDate: form.expiryDate || null };
      if (editProduct) { await api.put(`/api/products/${editProduct.id}`, payload); }
      else { await api.post("/api/products", payload); }
      setShowModal(false); fetchData();
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.message || "Failed to save product");
      else setError("Something went wrong");
    } finally { setSaving(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categoryId || form.categoryId === "__CREATE__") {
      if (!form.categoryInputText.trim()) { setError("Please select or create a category."); return; }
    }
    const buying = Number(form.buyingPrice), selling = Number(form.sellingPrice);
    if (buying > selling) { setShowLossConfirm(true); return; }
    if (!editProduct && !form.expiryDate) { setShowNoExpiryConfirm(true); return; }
    await doSave();
  };

  const handleLossConfirmed = () => {
    setShowLossConfirm(false);
    if (!editProduct && !form.expiryDate) setShowNoExpiryConfirm(true);
    else doSave();
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/api/products/${id}`); setDeleteId(null); fetchData(); }
    catch (err) { console.error(err); }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 })
      .format(n).replace("ETB", "Birr");
  const fmtNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);
  const fmtExpiry = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // Modal form content (shared between desktop centered and mobile bottom sheet)
  const ModalForm = () => (
    <form onSubmit={handleSave} className="px-4 sm:px-6 py-4 space-y-4">
      {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          required className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <CategoryCombo categories={categories} value={form.categoryId} inputText={form.categoryInputText}
          onChange={(id, text) => setForm({ ...form, categoryId: id, categoryInputText: text })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Buying Price</label>
          <input type="number" value={form.buyingPrice} onChange={(e) => setForm({ ...form, buyingPrice: e.target.value })}
            required min="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price</label>
          <input type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
            required min="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
        <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}
          min="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
        <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
        <p className="text-xs text-gray-400 mt-1">Leave empty if this product has no expiry date</p>
      </div>
      <div className="flex gap-3 pt-1 pb-2">
        <button type="button" onClick={() => setShowModal(false)}
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={saving}
          className="flex-1 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white px-4 py-2.5 rounded-lg text-sm font-medium">
          {saving ? "Saving..." : editProduct ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto pb-24 sm:pb-6">
        {/* Header — hide Add button on mobile (FAB used instead) */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Inventory</h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Manage your products and stock</p>
          </div>
          <button onClick={openAdd}
            className="hidden sm:flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />Add Product
          </button>
        </div>

        {/* Search — full width on mobile */}
        <div className="relative mb-4 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search products..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-left text-gray-500">
                    <th className="px-3 sm:px-4 py-3 font-medium">Product</th>
                    <th className="px-3 sm:px-4 py-3 font-medium hidden sm:table-cell">Buying Price</th>
                    <th className="px-3 sm:px-4 py-3 font-medium hidden sm:table-cell">Selling Price</th>
                    <th className="px-3 sm:px-4 py-3 font-medium">Stock</th>
                    <th className="px-3 sm:px-4 py-3 font-medium hidden md:table-cell">Expiry Date</th>
                    <th className="px-3 sm:px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No products found</td></tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isLow = p.stock <= p.lowStockAlert;
                      return (
                        <tr key={p.id} className={`border-b border-gray-50 ${isLow ? "bg-orange-50" : ""}`}>
                          <td className="px-3 sm:px-4 py-3">
                            <div className="flex items-start gap-1.5">
                              {isLow && <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />}
                              <div>
                                <p className="font-medium text-gray-800 text-sm">{p.name}</p>
                                {/* Category visible on mobile under name */}
                                <p className="text-xs text-gray-400 sm:hidden">{p.category.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-gray-600 hidden sm:table-cell">{fmt(p.buyingPrice)}</td>
                          <td className="px-3 sm:px-4 py-3 text-gray-600 hidden sm:table-cell">{fmt(p.sellingPrice)}</td>
                          <td className="px-3 sm:px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.stock === 0 ? "bg-red-100 text-red-600" : isLow ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"}`}>
                              {p.stock}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                            {p.expiryDate ? fmtExpiry(p.expiryDate) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 sm:px-4 py-3">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <button onClick={() => openEdit(p)}
                                className="touch-sm p-2 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => setDeleteId(p.id)}
                                className="touch-sm p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <button onClick={openAdd}
        className="sm:hidden fixed bottom-6 right-6 z-30 w-14 h-14 bg-rose-500 hover:bg-rose-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
        aria-label="Add product">
        <Plus className="w-6 h-6" />
      </button>

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
          {/* Desktop: centered card */}
          <div className="hidden sm:block w-full max-w-md bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-800">{editProduct ? "Edit Product" : "Add Product"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <ModalForm />
          </div>

          {/* Mobile: bottom sheet */}
          <div className="sm:hidden w-full bg-white rounded-t-2xl shadow-2xl max-h-[92vh] overflow-y-auto animate-slide-up">
            <div className="drag-handle mt-3" />
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-base font-semibold text-gray-800">{editProduct ? "Edit Product" : "Add Product"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <ModalForm />
          </div>
        </div>
      )}

      {/* ── Loss confirmation ── */}
      {showLossConfirm && (() => {
        const buying = Number(form.buyingPrice), selling = Number(form.sellingPrice), loss = buying - selling;
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-4 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-6 animate-slide-up sm:animate-none">
              <div className="drag-handle sm:hidden" />
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-red-100 p-2 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
                <h2 className="text-base font-semibold text-gray-800">Selling at a Loss!</h2>
              </div>
              <p className="text-gray-600 text-sm mb-5 leading-relaxed">
                You are buying for <span className="font-semibold text-gray-800">Birr {fmtNumber(buying)}</span> but
                selling for <span className="font-semibold text-gray-800">Birr {fmtNumber(selling)}</span>.
                You will lose <span className="font-semibold text-red-600">Birr {fmtNumber(loss)}</span> per unit.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowLossConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">Go Back</button>
                <button onClick={handleLossConfirmed}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium">Yes, Continue</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── No expiry confirmation ── */}
      {showNoExpiryConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60]">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-6 animate-slide-up sm:animate-none">
            <div className="drag-handle sm:hidden" />
            <h2 className="text-base font-semibold text-gray-800 mb-2">No Expiry Date</h2>
            <p className="text-gray-500 text-sm mb-5">Are you sure this product doesn&apos;t have an expiry date?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowNoExpiryConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">Go Back</button>
              <button onClick={async () => { setShowNoExpiryConfirm(false); await doSave(); }} disabled={saving}
                className="flex-1 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white px-4 py-2.5 rounded-lg text-sm font-medium">Yes, Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-6 animate-slide-up sm:animate-none">
            <div className="drag-handle sm:hidden" />
            <h2 className="text-base font-semibold text-gray-800 mb-2">Delete Product</h2>
            <p className="text-gray-500 text-sm mb-5">Are you sure? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">Cancel</button>
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
