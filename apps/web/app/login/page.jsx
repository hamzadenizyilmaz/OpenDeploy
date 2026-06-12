"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiConnectionMessage, apiFetch, clearTokens, setTokens } from "../../lib/api";
import { Notice } from "../../components/Notice";

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = useState("/dashboard");
  const [form, setForm] = useState({ email: "", password: "" });
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get("next") || "/dashboard");
    apiFetch("/setup/status", { method: "GET", auth: false })
      .then((data) => {
        setSetupRequired(!!data.required);
        if (data.required) router.replace("/setup");
      })
      .catch((err) => setError(apiConnectionMessage(err)));
  }, [router]);

  async function submit(event) {
    event.preventDefault();
    const payload = {
      email: form.email.trim().toLowerCase(),
      password: form.password
    };

    if (!payload.email) {
      setError("Email is required.");
      return;
    }
    if (!payload.password) {
      setError("Password is required.");
      return;
    }

    setLoading(true);
    setError("");
    clearTokens();
    try {
      const data = await apiFetch("/auth/login", { method: "POST", body: payload, auth: false });
      setTokens(data);
      router.replace(next);
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-slate-900 dark:bg-black dark:text-slate-100">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-800 bg-white p-8 shadow-2xl dark:bg-slate-900">
        <div className="mb-8">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 font-bold text-white dark:bg-white dark:text-slate-950">OD</div>
          <h1 className="text-2xl font-bold">Login to OpenDeploy</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Manage deployments, databases, domains and services.</p>
        </div>

        {setupRequired ? <Notice type="warning">First setup is required. Redirecting to setup...</Notice> : null}
        {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

        <label className="mb-4 block">
          <span className="text-sm font-medium">Email</span>
          <input
            className="input mt-1"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            autoComplete="email"
            inputMode="email"
            placeholder="admin@example.com"
            required
          />
        </label>

        <label className="mb-6 block">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            className="input mt-1"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            autoComplete="current-password"
            placeholder="Your password"
            required
          />
        </label>

        <button disabled={loading} className="w-full rounded-xl bg-slate-950 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200" type="submit">
          {loading ? "Logging in..." : "Login"}
        </button>
        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          New install? <Link className="underline" href="/setup">Create owner account</Link>
        </p>
      </form>
    </main>
  );
}
