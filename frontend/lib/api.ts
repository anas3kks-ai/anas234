export const API_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("omni_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem("omni_token", token);
  else window.localStorage.removeItem("omni_token");
}

export type ApiOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

export async function apiFetch<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== false) {
    const tok = getToken();
    if (tok) headers["Authorization"] = `Bearer ${tok}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.detail) detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {}
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type User = { id: number; email: string; name: string; created_at: string };
export type Conversation = {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
};
export type Message = {
  id: number;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tool_calls_json: string | null;
  tool_call_id: string | null;
  name: string | null;
  created_at: string;
};

export const api = {
  register: (email: string, password: string, name: string) =>
    apiFetch<{ access_token: string }>(`/api/auth/register`, {
      method: "POST",
      body: { email, password, name },
      auth: false,
    }),
  login: (email: string, password: string) =>
    apiFetch<{ access_token: string }>(`/api/auth/login`, {
      method: "POST",
      body: { email, password },
      auth: false,
    }),
  me: () => apiFetch<User>(`/api/auth/me`),
  listConversations: () => apiFetch<Conversation[]>(`/api/conversations`),
  createConversation: () =>
    apiFetch<Conversation>(`/api/conversations`, { method: "POST" }),
  getMessages: (id: number) => apiFetch<Message[]>(`/api/conversations/${id}/messages`),
  deleteConversation: (id: number) =>
    apiFetch<void>(`/api/conversations/${id}`, { method: "DELETE" }),
  postUserMessage: (id: number, message: string) =>
    apiFetch<{ id: number }>(`/api/agent/conversations/${id}/messages`, {
      method: "POST",
      body: { message },
    }),
  streamUrl: (id: number, token: string) =>
    `${API_URL}/api/agent/conversations/${id}/stream?token=${encodeURIComponent(token)}`,
};
