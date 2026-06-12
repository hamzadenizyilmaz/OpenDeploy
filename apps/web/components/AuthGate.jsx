"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch, clearTokens, getAccessToken } from "../lib/api";

export function AuthGate({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState({ ready: false, user: null });

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const token = getAccessToken();
      if (!token) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
        return;
      }

      try {
        const data = await apiFetch("/auth/me", { method: "GET" });
        if (!cancelled) setState({ ready: true, user: data.user });
      } catch (error) {
        clearTokens();
        router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!state.ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          Checking session...
        </div>
      </div>
    );
  }

  return children;
}
