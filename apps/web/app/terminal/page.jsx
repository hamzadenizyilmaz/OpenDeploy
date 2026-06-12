"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { apiFetch, humanDate } from "../../lib/api";
import { statusBadge, titleize } from "../../lib/format";

export default function TerminalPage() {
  const [rows, setRows] = useState([]);
  const [allow, setAllow] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ cwd: ".", command: "npm install", requireSudoConfirmation: false });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [sessions, allowlist] = await Promise.all([apiFetch("/terminal"), apiFetch("/terminal/allowlist")]);
      setRows(sessions.sessions || []);
      setAllow(allowlist.allowedCommands || []);
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
    setError("");
    setMessage("");
    try {
      await apiFetch("/terminal/sessions", { method: "POST", body: form });
      setMessage("Terminal session request created and audited.");
      setOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function selectCommand(command) {
    setForm((current) => ({ ...current, command }));
    setOpen(true);
  }

  return (
    <Shell>
      <PageHeader title="Terminal" description="Audited command launcher with strict allowlist, destructive command blocking and sudo confirmation." action={<ActionButton onClick={() => setOpen(true)}>New Session</ActionButton>} />

      {message ? <div className="mb-4"><Notice type="success">{message}</Notice></div> : null}
      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

      <h2 className="mb-3 font-semibold">Allowed Quick Commands</h2>
      <div className="mb-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {allow.map((command) => (
          <button key={command} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left font-mono text-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800" onClick={() => selectCommand(command)} type="button">
            {command}
          </button>
        ))}
      </div>

      <DataTable
        minWidth={820}
        columns={[
          { key: "id", label: "Session", render: (row) => String(row.id).slice(0, 8) },
          { key: "cwd", label: "CWD" },
          { key: "command", label: "Command" },
          { key: "status", label: "Status", render: (row) => <span className={`badge badge-${statusBadge(row.status)}`}>{titleize(row.status)}</span> },
          { key: "createdAt", label: "Created", render: (row) => humanDate(row.createdAt) }
        ]}
        rows={rows}
        empty="No terminal sessions yet."
      />

      <Modal open={open} onClose={() => setOpen(false)} title="New Terminal Session" description="Only allowlisted commands are accepted and every request is audited.">
        <form onSubmit={create} className="grid gap-4">
          <label>
            <span className="text-sm font-medium">Working directory</span>
            <input className="input mt-1" value={form.cwd} onChange={(event) => setForm({ ...form, cwd: event.target.value })} />
          </label>
          <label>
            <span className="text-sm font-medium">Command</span>
            <input className="input mt-1 font-mono" value={form.command} onChange={(event) => setForm({ ...form, command: event.target.value })} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.requireSudoConfirmation} onChange={(event) => setForm({ ...form, requireSudoConfirmation: event.target.checked })} />
            <span>I confirm sudo command risk</span>
          </label>
          <ActionButton onClick={create}>Create Session</ActionButton>
        </form>
      </Modal>
    </Shell>
  );
}
