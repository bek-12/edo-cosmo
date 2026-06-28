"use client";
import { useEffect, useState, useRef } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { Plus, Pencil, Trash2, X, AlertTriangle, Search, ChevronDown, ChevronUp } from "lucide-react";
import axios from "axios";

interface Category { id: string; name: string; }
interface ProductVariant {
  id: string; variantType: string; variantValue: string;
  stock: number; buyingPrice: number | null; sellingPrice: number | null;
}
interface Product {
  id: string; name: string; categoryId: string; category: Category;
  buyingPrice: number; sellingPrice: number; stock: number;
  lowStockAlert: number; expiryDate: string | null;
  hasVariants: boolean; unit: string | null; variants: ProductVariant[];
}
interface VariantForm {
  id?: string; variantValue: string; stock: string;
  buyingPrice: string; sellingPrice: string;
}
interface ProductForm {
  name: string; categoryId: string; categoryInputText: string;
  buyingPrice: string; sellingPrice: string; stock: string; expiryDate: string;
  hasVariants: boolean; unit: string; variantType: string; variants: VariantForm[];
}

const emptyVariant = (): VariantForm => ({ variantValue: "", stock: "", buyingPrice: "", sellingPrice: "" });
const emptyForm: ProductForm = {
  name: "", categoryId: "", categoryInputText: "",
  buyingPrice: "", sellingPrice: "", stock: "", expiryDate: "",
  hasVariants: false, unit: "", variantType: "shade", variants: [emptyVariant()],
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

/* ── Inline variant edit row ── */
function VariantEditRow({ variant, onSave, onDelete }: {
  variant: ProductVariant;
  onSave: (id: string, data: Partial<ProductVariant>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [stock, setStock] = useState(String(variant.stock));
  const [bp, setBp] = useState(variant.buyingPrice != null ? String(variant.buyingPrice) : "");
  const [sp, setSp] = useState(variant.sellingPrice != null ? String(variant.sellingPrice) : "");
  const [saving, setSaving] = useState(false);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 })
      .format(n).replace("ETB", "Birr");

  if (!editing) {
    return (
      <tr className={`text-xs border-b border-gray-50 ${variant.stock === 0 ? "bg-red-50" : "bg-gray-50"}`}>
        <td className="px-3 py-2 font-medium text-gray-700">{variant.variantValue}</td>
        <td className="px-3 py-2">
          <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${variant.stock === 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
            {variant.stock}
          </span>
        </td>
        <td className="px-3 py-2 text-gray-500">{variant.sellingPrice != null ? fmt(variant.sellingPrice) : "—"}</td>
        <td className="px-3 py-2">
          <div className="flex gap-1">
            <button onClick={() => setEditing(true)} className="p-1 rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(variant.id)} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-rose-50 border-b border-rose-100 text-xs">
      <td className="px-2 py-2"><span className="font-medium text-gray-700">{variant.variantValue}</span></td>
      <td className="px-2 py-2"><input type="number" value={stock} onChange={(e) => setStock(e.target.value)} min="0"
        className="w-16 px-2 py-1 border border-rose-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-rose-400" /></td>
      <td className="px-2 py-2"><input type="number" value={sp} onChange={(e) => setSp(e.target.value)} min="0" placeholder="Price"
        className="w-20 px-2 py-1 border border-rose-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-rose-400" /></td>
      <td className="px-2 py-2">
        <div className="flex gap-1">
          <button onClick={async () => { setSaving(true); await onSave(variant.id, { stock: Number(stock), buyingPrice: bp !== "" ? Number(bp) : null, sellingPrice: sp !== "" ? Number(sp) : null }); setEditing(false); setSaving(false); }}
            disabled={saving} className="px-2 py-1 bg-rose-500 text-white rounded text-xs disabled:opacity-50">
            {saving ? "…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs">✕</button>
        </div>
      </td>
    </tr>
  );
}

/* ── Modal form content (shared between desktop/mobile) ── */
function ModalFormContent({ form, setForm, categories, error, saving, editProduct, handleSave, setShowModal, setVariant }: {
  form: ProductForm; setForm: (f: ProductForm) => void; categories: Category[];
  error: string; saving: boolean; editProduct: Product | null;
  handleSave: (e: React.FormEvent) => Promise<void>;
  setShowModal: (v: boolean) => void;
  setVariant: (i: number, field: keyof VariantForm, val: string) => void;
}) {
  const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400";
  return (
    <form onSubmit={handleSave} className="px-4 sm:px-6 py-4 space-y-4">
      {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputCls} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <CategoryCombo categories={categories} value={form.categoryId} inputText={form.categoryInputText}
          onChange={(id, text) => setForm({ ...form, categoryId: id, categoryInputText: text })} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Unit <span className="text-gray-400 font-normal">(optional)</span></label>
        <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
          placeholder="e.g. ml, g, oz, pcs" className={inputCls} />
        <p className="text-xs text-gray-400 mt-1">Fill this if the product is measured by volume or weight</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Buying Price</label>
          <input type="number" value={form.buyingPrice} onChange={(e) => setForm({ ...form, buyingPrice: e.target.value })} required min="0" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price</label>
          <input type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} required min="0" className={inputCls} />
        </div>
      </div>

      {/* Variants toggle — full row is clickable */}
      <button
        type="button"
        onClick={() => setForm({ ...form, hasVariants: !form.hasVariants, variants: form.variants.length === 0 ? [{ variantValue: "", stock: "", buyingPrice: "", sellingPrice: "" }] : form.variants })}
        className="flex items-center gap-3 w-full text-left focus:outline-none"
        role="switch"
        aria-checked={form.hasVariants}
      >
        {/* Toggle pill — 44×24px */}
        <span className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 ${form.hasVariants ? "bg-rose-500" : "bg-gray-200"}`}>
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${form.hasVariants ? "translate-x-5" : "translate-x-0"}`} />
        </span>
        <span className="text-sm font-medium text-gray-700 select-none">
          This product has variants (shades/sizes)
        </span>
      </button>

      {/* Stock — only when no variants */}
      {!form.hasVariants && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
          <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} min="0" className={inputCls} />
        </div>
      )}

      {/* Variants section */}
      {form.hasVariants && (
        <div className="space-y-3 p-3 bg-blue-50 rounded-xl">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Variant Type</p>
            {/* Segmented control */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {["shade", "size", "other"].map((t) => (
                <button key={t} type="button"
                  onClick={() => setForm({ ...form, variantType: t })}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all duration-150 capitalize ${
                    form.variantType === t
                      ? "bg-white text-gray-800 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {form.variants.map((v, i) => (
            <div key={i} className="bg-white rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600">Variant {i + 1}</span>
                {form.variants.length > 1 && (
                  <button type="button"
                    onClick={() => setForm({ ...form, variants: form.variants.filter((_, idx) => idx !== i) })}
                    className="text-gray-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <input type="text" value={v.variantValue} onChange={(e) => setVariant(i, "variantValue", e.target.value)}
                placeholder={`${form.variantType === "shade" ? "e.g. 330, Ivory, Beige" : form.variantType === "size" ? "e.g. 200ml, 500ml" : "Value"}`}
                required className={inputCls} />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Stock</label>
                  <input type="number" value={v.stock} onChange={(e) => setVariant(i, "stock", e.target.value)} min="0" required className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Buy Price</label>
                  <input type="number" value={v.buyingPrice} onChange={(e) => setVariant(i, "buyingPrice", e.target.value)} min="0" placeholder="Same" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Sell Price</label>
                  <input type="number" value={v.sellingPrice} onChange={(e) => setVariant(i, "sellingPrice", e.target.value)} min="0" placeholder="Same" className={inputCls} />
                </div>
              </div>
            </div>
          ))}

          <button type="button"
            onClick={() => setForm({ ...form, variants: [...form.variants, emptyVariant()] })}
            className="w-full py-2 border-2 border-dashed border-blue-300 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
            + Add Variant
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
        <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className={inputCls} />
        <p className="text-xs text-gray-400 mt-1">Leave empty if this product has no expiry date</p>
      </div>

      <div className="flex gap-3 pt-1 pb-2">
        <button type="button" onClick={() => setShowModal(false)}
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">Cancel</button>
        <button type="submit" disabled={saving}
          className="flex-1 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white px-4 py-2.5 rounded-lg text-sm font-medium">
          {saving ? "Saving..." : editProduct ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "low" | "finished">("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
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
      setProducts(pRes.data); setCategories(cRes.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Search includes variant values + tab partition filter
  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) ||
      (p.hasVariants && p.variants.some((v) => v.variantValue.toLowerCase().includes(q)));
    if (!matchSearch) return false;
    if (tab === "finished") return p.stock === 0;
    if (tab === "low") return p.stock > 0 && p.stock <= p.lowStockAlert;
    return true; // "all"
  });

  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= p.lowStockAlert).length;
  const finishedCount = products.filter((p) => p.stock === 0).length;

  const openAdd = () => { setEditProduct(null); setForm(emptyForm); setError(""); setShowModal(true); };
  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({
      name: p.name, categoryId: p.categoryId, categoryInputText: p.category.name,
      buyingPrice: String(p.buyingPrice), sellingPrice: String(p.sellingPrice),
      stock: String(p.stock), expiryDate: p.expiryDate ? p.expiryDate.split("T")[0] : "",
      hasVariants: p.hasVariants, unit: p.unit ?? "", variantType: p.variants[0]?.variantType ?? "shade",
      variants: p.hasVariants && p.variants.length > 0
        ? p.variants.map((v) => ({ id: v.id, variantValue: v.variantValue, stock: String(v.stock), buyingPrice: v.buyingPrice != null ? String(v.buyingPrice) : "", sellingPrice: v.sellingPrice != null ? String(v.sellingPrice) : "" }))
        : [emptyVariant()],
    });
    setError(""); setShowModal(true);
  };

  const resolveCategory = async (f: ProductForm): Promise<string | null> => {
    if (f.categoryId && f.categoryId !== "__CREATE__") return f.categoryId;
    try {
      const res = await api.post("/api/categories", { name: f.categoryInputText });
      setCategories((prev) => prev.find((c) => c.id === res.data.id) ? prev : [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      return res.data.id;
    } catch { return null; }
  };

  const doSave = async () => {
    setSaving(true); setError("");
    try {
      const categoryId = await resolveCategory(form);
      if (!categoryId) { setError("Could not resolve category."); setSaving(false); return; }

      if (form.hasVariants && form.variants.length === 0) {
        setError("Add at least one variant."); setSaving(false); return;
      }
      if (form.hasVariants && form.variants.some((v) => !v.variantValue.trim())) {
        setError("All variants must have a value."); setSaving(false); return;
      }

      const payload = {
        name: form.name, categoryId,
        buyingPrice: Number(form.buyingPrice), sellingPrice: Number(form.sellingPrice),
        stock: form.hasVariants ? 0 : Number(form.stock),
        expiryDate: form.expiryDate || null,
        hasVariants: form.hasVariants, unit: form.unit || null,
        variants: form.hasVariants ? form.variants.map((v) => ({
          id: v.id, variantType: form.variantType, variantValue: v.variantValue,
          stock: Number(v.stock || 0),
          buyingPrice: v.buyingPrice !== "" ? Number(v.buyingPrice) : null,
          sellingPrice: v.sellingPrice !== "" ? Number(v.sellingPrice) : null,
        })) : undefined,
      };

      if (editProduct) await api.put(`/api/products/${editProduct.id}`, payload);
      else await api.post("/api/products", payload);
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
    if (!form.hasVariants && buying > selling) { setShowLossConfirm(true); return; }
    if (!editProduct && !form.expiryDate) { setShowNoExpiryConfirm(true); return; }
    await doSave();
  };

  const handleLossConfirmed = () => {
    setShowLossConfirm(false);
    if (!editProduct && !form.expiryDate) setShowNoExpiryConfirm(true); else doSave();
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/api/products/${id}`); setDeleteId(null); fetchData(); }
    catch (err) { console.error(err); }
  };

  const handleVariantSave = async (variantId: string, data: Partial<ProductVariant>) => {
    await api.put(`/api/variants/${variantId}`, data); fetchData();
  };

  const handleVariantDelete = async (variantId: string) => {
    await api.delete(`/api/variants/${variantId}`); fetchData();
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(n).replace("ETB", "Birr");
  const fmtNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);
  const fmtExpiry = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const setVariant = (i: number, field: keyof VariantForm, val: string) => {
    const next = form.variants.map((v, idx) => idx === i ? { ...v, [field]: val } : v);
    setForm({ ...form, variants: next });
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto pb-24 sm:pb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Inventory</h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Manage products and stock</p>
          </div>
          <button onClick={openAdd}
            className="hidden sm:flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" />Add Product
          </button>
        </div>

        <div className="relative mb-4 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search products or variants..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
        </div>

        {/* Tab partitions */}
        <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
          <button onClick={() => setTab("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "all" ? "bg-white shadow text-gray-800" : "text-gray-500 hover:text-gray-700"}`}>
            All Products
            <span className="ml-1.5 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{products.length}</span>
          </button>
          <button onClick={() => setTab("low")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab === "low" ? "bg-white shadow text-orange-600" : "text-gray-500 hover:text-orange-500"}`}>
            Low Stock
            {lowStockCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === "low" ? "bg-orange-100 text-orange-600" : "bg-orange-100 text-orange-500"}`}>{lowStockCount}</span>
            )}
          </button>
          <button onClick={() => setTab("finished")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab === "finished" ? "bg-white shadow text-red-600" : "text-gray-500 hover:text-red-500"}`}>
            Finished
            {finishedCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === "finished" ? "bg-red-100 text-red-600" : "bg-red-100 text-red-500"}`}>{finishedCount}</span>
            )}
          </button>
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
                    <th className="px-3 sm:px-4 py-3 font-medium hidden sm:table-cell">Buying</th>
                    <th className="px-3 sm:px-4 py-3 font-medium hidden sm:table-cell">Selling</th>
                    <th className="px-3 sm:px-4 py-3 font-medium">Stock</th>
                    <th className="px-3 sm:px-4 py-3 font-medium hidden md:table-cell">Expiry</th>
                    <th className="px-3 sm:px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No products found</td></tr>
                  ) : filteredProducts.map((p) => {
                    const isLow = p.stock <= p.lowStockAlert;
                    const expanded = expandedIds.has(p.id);
                    return (
                      <>
                        <tr key={p.id} className={`border-b border-gray-50 ${isLow ? "bg-orange-50" : ""}`}>
                          <td className="px-3 sm:px-4 py-3">
                            <div className="flex items-start gap-1.5">
                              {isLow && <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />}
                              <div>
                                <p className="font-medium text-gray-800 text-sm">{p.name}{p.unit ? ` (${p.unit})` : ""}</p>
                                <p className="text-xs text-gray-400 sm:hidden">{p.category.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-gray-600 hidden sm:table-cell">{fmt(p.buyingPrice)}</td>
                          <td className="px-3 sm:px-4 py-3 text-gray-600 hidden sm:table-cell">{fmt(p.sellingPrice)}</td>
                          <td className="px-3 sm:px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.stock === 0 ? "bg-red-100 text-red-600" : isLow ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"}`}>
                                {p.stock}
                              </span>
                              {p.hasVariants && (
                                <button onClick={() => toggleExpand(p.id)}
                                  className="flex items-center gap-0.5 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium hover:bg-blue-100">
                                  {p.variants.length} var {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                            {p.expiryDate ? fmtExpiry(p.expiryDate) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 sm:px-4 py-3">
                            <div className="flex gap-1">
                              <button onClick={() => openEdit(p)} className="p-2 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => setDeleteId(p.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {p.hasVariants && expanded && (
                          <tr key={`${p.id}-variants`} className="bg-blue-50/40">
                            <td colSpan={6} className="px-4 py-2">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-gray-400 border-b border-blue-100">
                                    <th className="pb-1 font-medium px-3">Value</th>
                                    <th className="pb-1 font-medium px-3">Stock</th>
                                    <th className="pb-1 font-medium px-3">Price</th>
                                    <th className="pb-1 font-medium px-3">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.variants.map((v) => (
                                    <VariantEditRow key={v.id} variant={v}
                                      onSave={handleVariantSave} onDelete={handleVariantDelete} />
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <button onClick={openAdd}
        className="sm:hidden fixed bottom-6 right-6 z-30 w-14 h-14 bg-rose-500 hover:bg-rose-600 text-white rounded-full shadow-lg flex items-center justify-center">
        <Plus className="w-6 h-6" />
      </button>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
          <div className="hidden sm:flex flex-col bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-800">{editProduct ? "Edit Product" : "Add Product"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              <ModalFormContent form={form} setForm={setForm} categories={categories}
                error={error} saving={saving} editProduct={editProduct}
                handleSave={handleSave} setShowModal={setShowModal} setVariant={setVariant} />
            </div>
          </div>
          {/* Mobile bottom sheet */}
          <div className="sm:hidden w-full bg-white rounded-t-2xl shadow-2xl max-h-[92vh] overflow-y-auto animate-slide-up">
            <div className="drag-handle mt-3" />
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-base font-semibold text-gray-800">{editProduct ? "Edit Product" : "Add Product"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <ModalFormContent form={form} setForm={setForm} categories={categories}
              error={error} saving={saving} editProduct={editProduct}
              handleSave={handleSave} setShowModal={setShowModal} setVariant={setVariant} />
          </div>
        </div>
      )}

      {/* Loss confirm */}
      {showLossConfirm && (() => {
        const buying = Number(form.buyingPrice), selling = Number(form.sellingPrice), loss = buying - selling;
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-4 sm:p-0">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-6 animate-slide-up sm:animate-none">
              <div className="drag-handle sm:hidden" />
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-red-100 p-2 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
                <h2 className="text-base font-semibold text-gray-800">Selling at a Loss!</h2>
              </div>
              <p className="text-gray-600 text-sm mb-5 leading-relaxed">
                Buying for <span className="font-semibold text-gray-800">Birr {fmtNumber(buying)}</span> selling for{" "}
                <span className="font-semibold text-gray-800">Birr {fmtNumber(selling)}</span>.
                Loss of <span className="font-semibold text-red-600">Birr {fmtNumber(loss)}</span> per unit.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowLossConfirm(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">Go Back</button>
                <button onClick={handleLossConfirmed} className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium">Yes, Continue</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* No expiry confirm */}
      {showNoExpiryConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60]">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-6 animate-slide-up sm:animate-none">
            <div className="drag-handle sm:hidden" />
            <h2 className="text-base font-semibold text-gray-800 mb-2">No Expiry Date</h2>
            <p className="text-gray-500 text-sm mb-5">Are you sure this product doesn&apos;t have an expiry date?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowNoExpiryConfirm(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">Go Back</button>
              <button onClick={async () => { setShowNoExpiryConfirm(false); await doSave(); }} disabled={saving}
                className="flex-1 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white px-4 py-2.5 rounded-lg text-sm font-medium">Yes, Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-6 animate-slide-up sm:animate-none">
            <div className="drag-handle sm:hidden" />
            <h2 className="text-base font-semibold text-gray-800 mb-2">Delete Product</h2>
            <p className="text-gray-500 text-sm mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
