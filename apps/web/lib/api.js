const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/$/, "");
}

function isLoopbackHost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(String(hostname || "").toLowerCase());
}

export function apiBaseUrl() {
  const configured = trimTrailingSlash(CONFIGURED_API_URL) || "/api";
  if (typeof window === "undefined") return configured;

  try {
    const resolved = new URL(configured, window.location.origin);
    const currentHost = window.location.hostname;

    if (isLoopbackHost(resolved.hostname) && !isLoopbackHost(currentHost)) {
      return "/api";
    }

    if (resolved.origin === window.location.origin) {
      return trimTrailingSlash(`${resolved.pathname}${resolved.search}`);
    }

    return trimTrailingSlash(resolved.toString());
  } catch {
    return "/api";
  }
}

export const API_URL = apiBaseUrl();

const ACCESS_KEY = "opendeploy_access_token";
const REFRESH_KEY = "opendeploy_refresh_token";
let memoryAccessToken = null;
let memoryRefreshToken = null;

function browserStorage() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function migrateLegacyTokens() {
  if (typeof window === "undefined") return;
  const storage = browserStorage();
  if (!storage) return;
  const legacyAccess = window.localStorage.getItem(ACCESS_KEY);
  const legacyRefresh = window.localStorage.getItem(REFRESH_KEY);
  if (legacyAccess && !storage.getItem(ACCESS_KEY)) storage.setItem(ACCESS_KEY, legacyAccess);
  if (legacyRefresh && !storage.getItem(REFRESH_KEY)) storage.setItem(REFRESH_KEY, legacyRefresh);
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  migrateLegacyTokens();
  return memoryAccessToken || browserStorage()?.getItem(ACCESS_KEY) || null;
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  migrateLegacyTokens();
  return memoryRefreshToken || browserStorage()?.getItem(REFRESH_KEY) || null;
}

export function setTokens({ accessToken, refreshToken }) {
  if (typeof window === "undefined") return;
  const storage = browserStorage();
  if (accessToken) {
    memoryAccessToken = accessToken;
    storage?.setItem(ACCESS_KEY, accessToken);
  }
  if (refreshToken) {
    memoryRefreshToken = refreshToken;
    storage?.setItem(REFRESH_KEY, refreshToken);
  }
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  memoryAccessToken = null;
  memoryRefreshToken = null;
  browserStorage()?.removeItem(ACCESS_KEY);
  browserStorage()?.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

function readableValidationMessage(data) {
  const details = data?.error?.details;
  const fieldErrors = details?.fieldErrors;
  if (fieldErrors && typeof fieldErrors === "object") {
    const first = Object.entries(fieldErrors).find(([, messages]) => Array.isArray(messages) && messages.length);
    if (first) return first[1][0];
  }
  if (Array.isArray(details?.issues) && details.issues.length) {
    return details.issues[0].message || data.message;
  }
  return data?.message || "API request failed";
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  const response = await fetch(`${apiBaseUrl()}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false || !data.data?.accessToken) return null;
  setTokens({ accessToken: data.data.accessToken });
  return data.data.accessToken;
}

export async function apiFetch(path, options = {}, retry = true) {
  const { auth = true, ...fetchOptions } = options;
  const token = auth ? getAccessToken() : null;
  const requestPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${apiBaseUrl()}${requestPath}`;
  const headers = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
      body: fetchOptions.body && typeof fetchOptions.body !== "string" ? JSON.stringify(fetchOptions.body) : fetchOptions.body
    });
  } catch (cause) {
    const error = new Error(`Network error while requesting ${url}`);
    error.code = "NETWORK_ERROR";
    error.cause = cause;
    throw error;
  }

  if (response.status === 401 && retry && auth !== false) {
    const nextToken = await refreshAccessToken();
    if (nextToken) return apiFetch(path, options, false);
    clearTokens();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const message = readableValidationMessage(data);
    const error = new Error(message === "API request failed" ? `API request failed with HTTP ${response.status}` : message);
    error.status = response.status;
    error.code = data.error?.code;
    error.details = data.error?.details;
    throw error;
  }
  return data.data;
}

export function apiConnectionMessage(error) {
  const detail = error?.message && !["Failed to fetch", "Load failed"].includes(error.message)
    ? ` Detail: ${error.message}`
    : "";
  return `Panel cannot reach the OpenDeploy API. Check opendeploy-api, PostgreSQL and reverse proxy services.${detail}`;
}

export function humanDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return String(value);
  }
}
