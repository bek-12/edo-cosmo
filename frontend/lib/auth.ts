import Cookies from "js-cookie";

const TOKEN_KEY = "auth_token";

export function saveToken(token: string): void {
  Cookies.set(TOKEN_KEY, token, { expires: 7, sameSite: "strict" });
}

export function getToken(): string | undefined {
  return Cookies.get(TOKEN_KEY);
}

export function removeToken(): void {
  Cookies.remove(TOKEN_KEY);
}

export interface DecodedUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "CASHIER";
  profileImage?: string | null;
  iat: number;
  exp: number;
}

export function getUser(): DecodedUser | null {
  const token = getToken();
  if (!token) return null;

  try {
    // Decode JWT payload (base64url)
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload) as DecodedUser;
  } catch {
    return null;
  }
}
