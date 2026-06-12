"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiConnectionMessage, apiFetch } from "../../lib/api";
import { Notice } from "../../components/Notice";

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "Owner", email: "admin@example.com", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch("/setup/status", { method: "GET", auth: false })
      .then((data) => {
        if (!data.required) setMessage("Setup is already completed. You can login now.");
      })
      .catch((err) => setError(apiConnectionMessage(err)));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch("/setup", {
        method: "POST",
        auth: false,
        body: {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password
        }
      });
      setMessage("Owner account created. Redirecting to login...");
      setTimeout(() => router.replace("/login"), 700);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950">
      <form onSubmit={submit} className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 font-bold text-white dark:bg-white dark:text-slate-950">OD</div>
          <h1 className="text-2xl font-bold">First Setup</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Create the first owner account for this OpenDeploy server.</p>
        </div>
        {message ? <div className="mb-4"><Notice type="success">{message}</Notice></div> : null}
        {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}
        {[
          ["name", "Name", "text"],
          ["email", "Email", "email"],
          ["password", "Password", "password"]
        ].map(([field, label, type]) => (
          <label key={field} className="mt-4 block">
            <span className="text-sm font-medium">{label}</span>
            <input type={type} className="input mt-1" value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} required />
          </label>
        ))}
        <button disabled={loading} className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200" type="submit">
          {loading ? "Creating..." : "Create Owner"}
        </button>
        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400"><Link className="underline" href="/login">Back to login</Link></p>
      </form>
    </main>
  );
}
