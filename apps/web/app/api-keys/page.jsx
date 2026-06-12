"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { apiFetch, humanDate } from "../../lib/api";

export default function ApiKeysPage() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [form, setForm] = useState({ name: "CI/CD Deploy Key", expiresAt: "" });
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await apiFetch("/api-keys");
      setRows(data.keys || []);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(event) {
    event.preventDefault();
    try {
      const data = await apiFetch("/api-keys", {
        method: "POST",
        body: { name: form.name, expiresAt: form.expiresAt || null }
      });
      setToken(data.token);
      setOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function revoke(row) {
    try {
      await apiFetch(`/api-keys/${row.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <PageHeader
        title="API Keys"
        description="Create scoped automation keys. Tokens are hashed and only shown once."
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Link className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800" href="/api-docs">
              <BookOpen className="h-4 w-4" />
              API Docs
            </Link>
            <ActionButton onClick={() => setOpen(true)}>New API Key</ActionButton>
          </div>
        )}
      />

      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}
      {token ? <div className="mb-4"><Notice type="success"><b>Copy now:</b> <code className="break-all">{token}</code></Notice></div> : null}

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-semibold">Automation header</div>
        <code className="mt-2 block overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">X-OpenDeploy-Key: od_live_xxxxxxxxxxxxxxxxx</code>
        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Use API keys for CI/CD, deployment bots, monitoring integrations and safe external automation.</div>
      </div>

      <DataTable
        minWidth={640}
        columns={[
          { key: "name", label: "Name" },
          { key: "lastUsedAt", label: "Last Used", render: (row) => humanDate(row.lastUsedAt) },
          { key: "expiresAt", label: "Expires", render: (row) => humanDate(row.expiresAt) },
          { key: "createdAt", label: "Created", render: (row) => humanDate(row.createdAt) },
          { key: "actions", label: "Actions", render: (row) => <ActionButton variant="danger" onClick={() => revoke(row)}>Revoke</ActionButton> }
        ]}
        rows={rows}
        empty="No API keys yet."
      />

      <Modal open={open} onClose={() => setOpen(false)} title="New API Key" description="Use X-OpenDeploy-Key header for automation.">
        <form onSubmit={create} className="grid gap-4">
          <label>
            <span className="text-sm font-medium">Name</span>
            <input className="input mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            <span className="text-sm font-medium">Expires at</span>
            <input
              className="input mt-1"
              type="datetime-local"
              value={form.expiresAt}
              onChange={(event) => setForm({ ...form, expiresAt: event.target.value ? new Date(event.target.value).toISOString() : "" })}
            />
          </label>
          <ActionButton type="submit">Create API Key</ActionButton>
        </form>
      </Modal>
    </Shell>
  );
}
