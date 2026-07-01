"use client";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle, AlertTriangle, X } from "lucide-react";
import axios from "axios";

interface Category { id: string; name: string; }
interface Product { id: string; name: string; category: Category; sellingPrice: number; stock: number; }
// priceStr kept as string so typing "65" doesn't snap to "6" on each keystroke
interface CartItem { product: Product; quantity: number; priceStr: string; }

export default function SalesPage() {
  const [products, setProducts]       = useState<Product[]>([]);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [search, setSearch]           = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loading, setLoading]         = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [success, setSuccess]         = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [cartOpen, setCartOpen]       = useState(false);

  const fetchData = async () => {
    try {
      const [pRes, cRes] = await Promise.all([api.get("/api/products"), api.get("/api/categories")]);
      setProducts(pRes.data); setCategories(cRes.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    document.body.style.overflow = cartOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [cartOpen]);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory ? p.category.id === selectedCategory : true;
    return matchSearch && matchCat && p.stock > 0;
  });

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, priceStr: String(product.sellingPrice) }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => item.product.id === productId ? { ...item, quantity: item.quantity + delta } : item)
          .filter((item) => item.quantity > 0)
    );
  };

  // Store raw string — no parsing on every keystroke
  const updatePrice = (productId: string, val: string) => {
    setCart((prev) =>
      prev.map((item) => item.product.id === productId ? { ...item, priceStr: val } : item)
    );
  };

  const removeFromCart = (productId: string) =>
    setCart((prev) => prev.filter((item) => item.product.id !== productId));

  // Parse only when needed for display/checkout — fall back to original sellingPrice
  const getPrice = (item: CartItem): number => {
    const n = parseFloat(item.priceStr);
    return isNaN(n) || n < 0 ? item.product.sellingPrice : n;
  };

  const totalAmount = cart.reduce((sum, item) => sum + getPrice(item) * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckingOut(true); setCheckoutError("");
    try {
      await api.post("/api/sales", {
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          priceAtSale: getPrice(item),
        })),
      });
      setCart([]); setSuccess(true); setCartOpen(false); fetchData();
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      if (axios.isAxiosError(err)) setCheckoutError(err.response?.data?.message || "Checkout failed.");
      else setCheckoutError("Something went wrong.");
    } finally { setCheckingOut(false); }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 })
      .format(n).replace("ETB", "Birr");

  // ── Cart JSX built as a variable, NOT a nested component function.
  // Defining it as const CartItems = () => (...) inside the render body causes
  // React to treat it as a new component on every render → input loses focus.
  const cartContent = (
    <>
      {success && (
        <div className="mx-4 mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle className="w-4 h-4" />Sale completed!
        </div>
      )}
      {checkoutError && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />{checkoutError}
        </div>
      )}
      <div className="flex-1 overflow-y-auto scroll-touch px-4 py-3">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-300 gap-2">
            <ShoppingCart className="w-8 h-8" /><p className="text-sm">Cart is empty</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((item) => {
              const price        = getPrice(item);
              const originalPrice = item.product.sellingPrice;
              const isDiscounted  = price < originalPrice;
              const discount      = originalPrice - price;
              return (
                <div key={item.product.id} className="p-2.5 bg-gray-50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 leading-tight">{item.product.name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-gray-400">Birr</span>
                        <input
                          type="number"
                          value={item.priceStr}
                          onChange={(e) => updatePrice(item.product.id, e.target.value)}
                          min="0"
                          className="w-20 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-rose-400"
                        />
                        {isDiscounted && (
                          <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            Discounted
                          </span>
                        )}
                      </div>
                      {isDiscounted && (
                        <p className="text-xs text-amber-500 mt-0.5">− {fmt(discount)} off</p>
                      )}
                      <p className="text-xs font-bold text-rose-600 mt-0.5">{fmt(price * item.quantity)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <button onClick={() => removeFromCart(item.product.id)} className="text-gray-300 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(item.product.id, -1)}
                          className="w-6 h-6 bg-gray-200 hover:bg-rose-100 rounded flex items-center justify-center">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-semibold w-5 text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(item.product.id, 1)}
                          disabled={item.quantity >= item.product.stock}
                          className="w-6 h-6 bg-gray-200 hover:bg-rose-100 rounded flex items-center justify-center disabled:opacity-40">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex justify-between items-center mb-3">
          <span className="font-medium text-gray-600">Total</span>
          <span className="text-xl font-bold text-gray-800">{fmt(totalAmount)}</span>
        </div>
        <button onClick={handleCheckout} disabled={cart.length === 0 || checkingOut}
          className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 rounded-xl text-sm min-h-[44px]">
          {checkingOut ? "Processing..." : "Checkout"}
        </button>
      </div>
    </>
  );

  const productGrid = (cols: string) => (
    <div className={`grid ${cols} gap-2 sm:gap-3`}>
      {filtered.map((p) => {
        const inCart = cart.some((c) => c.product.id === p.id);
        return (
          <button key={p.id} onClick={() => addToCart(p)}
            className={`text-left p-2.5 sm:p-3 rounded-xl border transition-all shadow-sm ${inCart ? "border-rose-400 bg-rose-50" : "border-gray-100 bg-white hover:border-rose-200 hover:bg-rose-50"}`}>
            <div className="w-full h-8 sm:h-10 bg-gradient-to-br from-rose-100 to-pink-100 rounded-lg mb-1.5 sm:mb-2 flex items-center justify-center">
              <span className="text-rose-400">✨</span>
            </div>
            <p className="text-xs font-semibold text-gray-700 leading-tight line-clamp-2">{p.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{p.category.name}</p>
            <p className="text-sm font-bold text-rose-600 mt-1">{fmt(p.sellingPrice)}</p>
            <p className="text-xs text-gray-400">×{p.stock}</p>
          </button>
        );
      })}
      {filtered.length === 0 && <div className="col-span-full text-center text-gray-400 py-8 text-sm">No products found</div>}
    </div>
  );

  return (
    <Layout>
      {/* Desktop */}
      <div className="hidden lg:flex h-screen overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          <div className="mb-4">
            <h1 className="text-xl font-bold text-gray-800">Point of Sale</h1>
            <p className="text-gray-500 text-sm">Select products to add to cart</p>
          </div>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
            </div>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {loading ? <div className="flex items-center justify-center flex-1 text-gray-400">Loading...</div> : (
            <div className="overflow-y-auto flex-1">{productGrid("grid-cols-2 md:grid-cols-3 lg:grid-cols-4")}</div>
          )}
        </div>
        <div className="w-80 bg-white border-l border-gray-100 flex flex-col shadow-sm">
          <div className="px-4 py-4 border-b border-gray-100 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-rose-500" /><h2 className="font-semibold text-gray-800">Cart</h2>
            {cart.length > 0 && (
              <span className="ml-auto text-xs bg-rose-100 text-rose-600 font-semibold px-2 py-0.5 rounded-full">
                {cart.length} item{cart.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {cartContent}
        </div>
      </div>

      {/* Mobile */}
      <div className="lg:hidden flex flex-col pb-28">
        <div className="p-4">
          <h1 className="text-xl font-bold text-gray-800 mb-3">Point of Sale</h1>
          <div className="flex flex-col gap-2 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
            </div>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {success && (
            <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="w-4 h-4" />Sale completed!
            </div>
          )}
          {loading ? <div className="flex items-center justify-center h-40 text-gray-400">Loading...</div> : (
            productGrid("grid-cols-2")
          )}
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 shadow-lg px-4 py-3">
          <button onClick={() => setCartOpen(true)}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-between px-4 min-h-[44px]">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /><span>Cart</span>
              {cart.length > 0 && <span className="bg-white text-rose-500 font-bold text-xs px-1.5 py-0.5 rounded-full">{cart.length}</span>}
            </div>
            <span className="font-bold">{fmt(totalAmount)}</span>
          </button>
        </div>
      </div>

      {/* Mobile cart sheet */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] animate-slide-up">
            <div className="drag-handle mt-3" />
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-rose-500" />
                <h2 className="font-semibold text-gray-800">Cart</h2>
                {cart.length > 0 && <span className="text-xs bg-rose-100 text-rose-600 font-semibold px-2 py-0.5 rounded-full">{cart.length} item{cart.length !== 1 ? "s" : ""}</span>}
              </div>
              <button onClick={() => setCartOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {cartContent}
          </div>
        </div>
      )}
    </Layout>
  );
}
