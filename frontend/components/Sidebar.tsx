"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart2,
  LogOut,
  Sparkles,
  Settings,
  Menu,
  X,
  User,
  RotateCcw,
} from "lucide-react";
import { removeToken, getUser, DecodedUser } from "@/lib/auth";
import api from "@/lib/api";

interface ShopSettings {
  shopName: string;
  shopLogo: string | null;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/sales", label: "Sales (POS)", icon: ShoppingCart },
  { href: "/reports", label: "Reports", icon: BarChart2 },
  { href: "/returns", label: "Returns", icon: RotateCcw },
];

// ── Shared nav content (used in both desktop sidebar + mobile drawer) ──────
function NavContent({
  shop,
  user,
  pathname,
  onNavigate,
  onLogout,
}: {
  shop: ShopSettings;
  user: DecodedUser | null;
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      {/* TOP — logo, never shrinks */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-rose-100">
        <div className="flex items-center gap-2">
          {shop.shopLogo ? (
            <img
              src={shop.shopLogo}
              alt={shop.shopName}
              className="w-7 h-7 rounded-full object-cover border border-rose-100"
            />
          ) : (
            <Sparkles className="text-rose-500 w-6 h-6 flex-shrink-0" />
          )}
          <span className="text-xl font-bold text-rose-600 truncate">{shop.shopName}</span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Cosmetics Management</p>
      </div>

      {/* MIDDLE — nav links, scrolls only if needed */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-1 scrollbar-thin scrollbar-thumb-rose-100">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-rose-50 text-rose-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-rose-500"
              }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${active ? "text-rose-500" : "text-gray-400"}`} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* BOTTOM — profile + user + logout, always pinned, never shrinks */}
      <div className="flex-shrink-0 px-4 pt-3 pb-6 border-t border-rose-100">
        <Link
          href="/profile"
          onClick={onNavigate}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 ${
            pathname === "/profile"
              ? "bg-rose-50 text-rose-600"
              : "text-gray-600 hover:bg-gray-50 hover:text-rose-500"
          }`}
        >
          <Settings
            className={`w-5 h-5 flex-shrink-0 ${pathname === "/profile" ? "text-rose-500" : "text-gray-400"}`}
          />
          Profile Settings
        </Link>

        {user && (
          <div className="mb-1 px-3 py-1">
            <p className="text-sm font-semibold text-gray-700 truncate">{user.name}</p>
            <span
              className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${
                user.role === "ADMIN"
                  ? "bg-rose-100 text-rose-600"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {user.role}
            </span>
          </div>
        )}

        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-5 h-5 text-gray-400 flex-shrink-0" />
          Logout
        </button>
      </div>
    </>
  );
}

// ── Main Sidebar export ──────────────────────────────────────────────────────
export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<DecodedUser | null>(null);
  const [shop, setShop] = useState<ShopSettings>({ shopName: "GlowShop", shopLogo: null });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchShop = () => {
    api
      .get("/api/profile")
      .then((res) => {
        const ss = res.data.shopSettings;
        if (ss) setShop({ shopName: ss.shopName ?? "GlowShop", shopLogo: ss.shopLogo ?? null });
      })
      .catch(() => {});
  };

  useEffect(() => {
    setUser(getUser());
    // Silently wake up Render server on every app load
    fetch("https://edo-cosmo.onrender.com/health").catch(() => {});
    fetchShop();
    window.addEventListener("shopSettingsUpdated", fetchShop);
    return () => window.removeEventListener("shopSettingsUpdated", fetchShop);
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  const userInitials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <>
      {/* ── DESKTOP sidebar (lg+) ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 h-screen fixed top-0 left-0 bg-white border-r border-rose-100 flex-col shadow-sm flex-shrink-0 overflow-hidden z-30">
        <NavContent
          shop={shop}
          user={user}
          pathname={pathname}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── MOBILE top navbar (below lg) ─────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-rose-100 shadow-sm flex items-center px-4 gap-3">
        {/* Hamburger */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg text-gray-600 hover:bg-rose-50 hover:text-rose-500 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Center: logo + name */}
        <div className="flex-1 flex items-center justify-center gap-2">
          {shop.shopLogo ? (
            <img
              src={shop.shopLogo}
              alt={shop.shopName}
              className="w-6 h-6 rounded-full object-cover border border-rose-100"
            />
          ) : (
            <Sparkles className="text-rose-500 w-5 h-5" />
          )}
          <span className="font-bold text-rose-600 text-base truncate max-w-[160px]">
            {shop.shopName}
          </span>
        </div>

        {/* Right: profile avatar */}
        <Link
          href="/profile"
          className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-xs flex-shrink-0"
          aria-label="Profile"
        >
        {user?.profileImage ? (
            <img
              src={user.profileImage}
              alt="profile"
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <User className="w-4 h-4 text-rose-500" />
          )}
        </Link>
      </header>

      {/* ── MOBILE drawer overlay ─────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
          aria-modal="true"
          role="dialog"
        >
          {/* Dark overlay */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer panel */}
          <div className="relative w-72 max-w-[85vw] h-full bg-white flex flex-col shadow-2xl animate-slide-in-left">
            {/* Close button */}
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 z-10"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>

            <NavContent
              shop={shop}
              user={user}
              pathname={pathname}
              onNavigate={() => setDrawerOpen(false)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}
    </>
  );
}
