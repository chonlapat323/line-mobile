import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

export const API_URL = "https://sales.beautyup-enterprise.com";

const TIMEOUT_MS = 10000; // 10 วินาที

async function getToken() {
  return await SecureStore.getItemAsync("token");
}

async function request(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 401) {
      if (path !== "/auth/login") {
        await SecureStore.deleteItemAsync("token");
        await SecureStore.deleteItemAsync("user");
        router.replace("/login");
      }
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || "Request failed");
    }
    return res.json();
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("การเชื่อมต่อหมดเวลา กรุณาตรวจสอบ internet");
    }
    if (err instanceof TypeError && err.message.includes("Network request failed")) {
      throw new Error("ไม่สามารถเชื่อมต่อ server ได้ กรุณาตรวจสอบ internet");
    }
    throw err;
  }
}

export const api = {
  login: (email: string, password: string) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  getUsers: () => request("/users"),
  getMe: () => request("/users/me"),
  getVerificationCode: (userId: string) => request(`/users/${userId}/verification-code`),
  getHistory: () => request("/line/history"),
  getSettings: () => request("/settings"),

  sendMessage: (formData: FormData) =>
    request("/line/send", { method: "POST", body: formData }),

  createVisit: (formData: FormData) =>
    request("/visits", { method: "POST", body: formData }),

  verifySlip: (formData: FormData) =>
    request("/visits/verify-slip", { method: "POST", body: formData }),

  getVisits: () => request("/visits"),
  updateMe: (data: { bankName?: string; bankAccount?: string }) =>
    request("/users/me", { method: "PATCH", body: JSON.stringify(data) }),
  getMyCommission: (month: string) => request(`/visits/my-commission?month=${month}`),
};

export async function saveToken(token: string, user: object) {
  await SecureStore.setItemAsync("token", token);
  await SecureStore.setItemAsync("user", JSON.stringify(user));
}

export async function clearToken() {
  await SecureStore.deleteItemAsync("token");
  await SecureStore.deleteItemAsync("user");
}

export async function getStoredUser() {
  const u = await SecureStore.getItemAsync("user");
  return u ? JSON.parse(u) : null;
}
