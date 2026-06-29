"use client";
import { useEffect, useRef, useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { Eye, EyeOff, Camera, CheckCircle, AlertTriangle } from "lucide-react";
import axios from "axios";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  profileImage: string | null;
}

interface ShopSettings {
  shopName: string;
  shopLogo: string | null;
  email: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Avatar component ─────────────────────────────────────────────────────────
function AvatarUpload({
  image,
  name,
  size = "lg",
  onUpload,
}: {
  image: string | null;
  name: string;
  size?: "lg" | "md";
  onUpload: (base64: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dim = size === "lg" ? "w-24 h-24 text-2xl" : "w-16 h-16 text-lg";

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    onUpload(base64);
    e.target.value = "";
  };

  return (
    <div
      className={`relative ${dim} rounded-full cursor-pointer group`}
      onClick={() => inputRef.current?.click()}
    >
      {image ? (
        <img
          src={image}
          alt={name}
          className="w-full h-full rounded-full object-cover border-2 border-rose-100"
        />
      ) : (
        <div
          className={`w-full h-full rounded-full bg-rose-100 flex items-center justify-center font-bold text-rose-500 border-2 border-rose-200 ${dim}`}
        >
          {getInitials(name || "?")}
        </div>
      )}
      {/* Hover overlay */}
      <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Camera className="w-5 h-5 text-white" />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

// ── Alert component ───────────────────────────────────────────────────────────
function Alert({ type, message }: { type: "success" | "error"; message: string }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${
        type === "success"
          ? "bg-green-50 border border-green-200 text-green-700"
          : "bg-red-50 border border-red-200 text-red-700"
      }`}
    >
      {type === "success" ? (
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      )}
      {message}
    </div>
  );
}

// ── Password field ────────────────────────────────────────────────────────────
function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "••••••••"}
          className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [shopSettings, setShopSettings] = useState<ShopSettings>({
    shopName: "GlowShop",
    shopLogo: null,
    email: null,
  });
  const [loading, setLoading] = useState(true);

  // Personal form state
  const [personalName, setPersonalName] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalImage, setPersonalImage] = useState<string | null>(null);
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalAlert, setPersonalAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Password form state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwAlert, setPwAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [pwMatchError, setPwMatchError] = useState("");

  // Shop form state
  const [shopName, setShopName] = useState("");
  const [shopEmail, setShopEmail] = useState("");
  const [shopLogo, setShopLogo] = useState<string | null>(null);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopAlert, setShopAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Load profile on mount
  useEffect(() => {
    api
      .get("/api/profile")
      .then((res) => {
        const { user, shopSettings: ss } = res.data;
        setUserProfile(user);
        setPersonalName(user.name);
        setPersonalEmail(user.email);
        setPersonalImage(user.profileImage ?? null);

        setShopSettings(ss);
        setShopName(ss.shopName ?? "GlowShop");
        setShopEmail(ss.email ?? "");
        setShopLogo(ss.shopLogo ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Personal save ────────────────────────────────────────────────────────
  const handlePersonalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalSaving(true);
    setPersonalAlert(null);
    try {
      const res = await api.put("/api/profile/personal", {
        name: personalName,
        email: personalEmail,
        profileImage: personalImage,
      });
      setUserProfile(res.data.user);
      setPersonalAlert({ type: "success", msg: "Profile updated successfully!" });
      // Notify Sidebar to refresh avatar
      window.dispatchEvent(new Event("profileUpdated"));
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || "Failed to update profile"
        : "Something went wrong";
      setPersonalAlert({ type: "error", msg });
    } finally {
      setPersonalSaving(false);
    }
  };

  // ── Password save ─────────────────────────────────────────────────────────
  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMatchError("");
    setPwAlert(null);

    if (newPw.length < 6) {
      setPwMatchError("New password must be at least 6 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwMatchError("New password and confirm password do not match.");
      return;
    }

    setPwSaving(true);
    try {
      await api.put("/api/profile/password", {
        currentPassword: currentPw,
        newPassword: newPw,
      });
      setPwAlert({ type: "success", msg: "Password changed successfully!" });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || "Failed to change password"
        : "Something went wrong";
      setPwAlert({ type: "error", msg });
    } finally {
      setPwSaving(false);
    }
  };

  // ── Shop save ─────────────────────────────────────────────────────────────
  const handleShopSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setShopSaving(true);
    setShopAlert(null);
    try {
      const res = await api.put("/api/profile/shop", {
        shopName,
        shopLogo,
        email: shopEmail,
      });
      setShopSettings(res.data.shopSettings);
      setShopAlert({ type: "success", msg: "Shop settings saved!" });
      // Notify the Sidebar to re-fetch the updated shop name/logo
      window.dispatchEvent(new Event("shopSettingsUpdated"));
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || "Failed to save shop settings"
        : "Something went wrong";
      setShopAlert({ type: "error", msg });
    } finally {
      setShopSaving(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400";

  const btnCls =
    "w-full sm:w-auto px-5 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]";

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Profile Settings</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Manage your account and shop configuration</p>
        </div>

        {/* ── SECTION 1: Personal Info ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-6">
          <h2 className="text-sm sm:text-base font-semibold text-gray-800 mb-4 sm:mb-5">Personal Information</h2>
          <form onSubmit={handlePersonalSave} className="space-y-4 sm:space-y-5">
            {/* Avatar — centered on mobile */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
              <AvatarUpload image={personalImage} name={personalName} size="lg" onUpload={(b64) => setPersonalImage(b64)} />
              <div className="text-center sm:text-left">
                <p className="text-sm font-medium text-gray-700">{userProfile?.name}</p>
                <p className="text-xs text-gray-400">{userProfile?.email}</p>
                <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${userProfile?.role === "ADMIN" ? "bg-rose-100 text-rose-600" : "bg-gray-100 text-gray-500"}`}>
                  {userProfile?.role}
                </span>
                <p className="text-xs text-gray-400 mt-1">Click the photo to change it</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={personalName} onChange={(e) => setPersonalName(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} required className={inputCls} />
            </div>
            {personalAlert && <Alert type={personalAlert.type} message={personalAlert.msg} />}
            <button type="submit" disabled={personalSaving} className={btnCls}>{personalSaving ? "Saving..." : "Save Personal Info"}</button>
          </form>
        </div>

        {/* ── SECTION 2: Change Password ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-6">
          <h2 className="text-sm sm:text-base font-semibold text-gray-800 mb-4 sm:mb-5">Change Password</h2>
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <PasswordInput label="Current Password" value={currentPw} onChange={setCurrentPw} />
            <PasswordInput label="New Password" value={newPw} onChange={(v) => { setNewPw(v); setPwMatchError(""); }} placeholder="Min. 6 characters" />
            <PasswordInput label="Confirm New Password" value={confirmPw} onChange={(v) => { setConfirmPw(v); setPwMatchError(""); }} />
            {pwMatchError && (
              <p className="text-sm text-red-500 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />{pwMatchError}
              </p>
            )}
            {pwAlert && <Alert type={pwAlert.type} message={pwAlert.msg} />}
            <button type="submit" disabled={pwSaving} className={btnCls}>{pwSaving ? "Changing..." : "Change Password"}</button>
          </form>
        </div>

        {/* ── SECTION 3: Shop Settings ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-6">
          <h2 className="text-sm sm:text-base font-semibold text-gray-800 mb-4 sm:mb-5">Shop Settings</h2>
          <form onSubmit={handleShopSave} className="space-y-4 sm:space-y-5">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
              <AvatarUpload image={shopLogo} name={shopName || "GS"} size="lg" onUpload={(b64) => setShopLogo(b64)} />
              <div className="text-center sm:text-left">
                <p className="text-sm font-medium text-gray-700">{shopName || "GlowShop"}</p>
                <p className="text-xs text-gray-400">Click the logo to change it</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
              <input type="text" value={shopName} onChange={(e) => setShopName(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop Email</label>
              <input type="email" value={shopEmail} onChange={(e) => setShopEmail(e.target.value)} className={inputCls} placeholder="shop@example.com" />
            </div>
            {shopAlert && <Alert type={shopAlert.type} message={shopAlert.msg} />}
            <button type="submit" disabled={shopSaving} className={btnCls}>{shopSaving ? "Saving..." : "Save Shop Settings"}</button>
            <p className="text-xs text-gray-400">The shop name and logo will appear on the sidebar and receipts.</p>
          </form>
        </div>
      </div>
    </Layout>
  );
}
