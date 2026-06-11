import * as SecureStore from "expo-secure-store";

const API_URL = "https://e043-2001-fb1-10f-6cf9-ad89-e3fc-b270-8918.ngrok-free.app";

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

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Request failed");
  }
  return res.json();
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
