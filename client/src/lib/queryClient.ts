import { QueryClient, QueryFunction } from "@tanstack/react-query";

// In the web build (served from flexinfitapp.com), API_BASE is "" so calls go to /api/* on the same origin.
// In the native iOS/Android build (served from capacitor://localhost), Vite injects VITE_API_BASE_URL
// at build time so all /api/* calls hit the live flexinfitapp.com server.
const BUILD_API_BASE = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
export const API_BASE = BUILD_API_BASE && BUILD_API_BASE.length > 0
  ? BUILD_API_BASE.replace(/\/$/, "")
  : ("__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__");

// Store current user email — persisted to localStorage so user stays logged in
const STORAGE_KEY = "flexin_user_email";
let _userEmail: string = (() => {
  try { return localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; }
})();

export function setUserEmail(email: string) {
  _userEmail = email;
  try { if (email) localStorage.setItem(STORAGE_KEY, email); else localStorage.removeItem(STORAGE_KEY); } catch {}
}
export function getUserEmail(): string { return _userEmail; }
export function clearUserEmail() {
  _userEmail = "";
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("flexin_picked_experience");
  } catch {}
}

export function markExperiencePicked() {
  try { localStorage.setItem("flexin_picked_experience", "1"); } catch {}
}

export function hasPickedExperience(): boolean {
  try { return !!localStorage.getItem("flexin_picked_experience"); } catch { return false; }
}

function getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (_userEmail) headers["x-user-email"] = _userEmail;
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers = getAuthHeaders(data ? { "Content-Type": "application/json" } : {});
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, {
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && (res.status === 401 || res.status === 404)) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
