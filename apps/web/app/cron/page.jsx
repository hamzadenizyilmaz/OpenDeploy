"use client";

import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { apiFetch, humanDate } from "../../lib/api";
import { statusBadge, titleize } from "../../lib/format";

const taskTypes = ["system_update_check", "package_update_check", "service_health_check", "ssl_expiry_check", "backup_check", "custom_command"];

export default function CronPage() {
  const [rows, setRows] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "Server Update Watch", type: "system_update_check", schedule: "0 */6 * * *", target: "", notify: true, enabled: true });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const data = await apiFetch("/cron");
      setRows(data.tasks || []);
      setNotifications(data.notifications || []);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => ({
    enabled: rows.filter((row) => row.enabled !== false).length,
    notify: rows.filter((row) => row.notify).length,
    warning: rows.filter((row) => ["warning", "failed", "error"].includes(String(row.lastStatus || "").toLowerCase())).length
  }), [rows]);

  async function installDefaults() {
    setError("");
    setMessage("");
    try {
      await apiFetch("/cron/install-defaults", { method: "POST", body: {} });
      setMessage("Default watches installed.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function create(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiFetch("/cron", { method: "POST", body: form });
      setMessage("Auto Cron task created.");
      setOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function run(row) {
    setError("");
    setMessage("");
    try {
      await apiFetch(`/cron/${row.id}/run`, { method: "POST", body: {} });
      setMessage(`${row.name} executed.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggle(row) {
    setError("");
    setMessage("");
    try {
      await apiFetch(`/cron/${row.id}/toggle`, { method: "PATCH", body: { enabled: row.enabled === false } });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Auto Cron"
        description="Watch OpenDeploy releases, package updates, SSL expiry, service health and backup freshness with notifications."
        action={(
          <>
            <ActionButton variant="secondary" onClick={installDefaults}>Install Defaults</ActionButton>
            <ActionButton onClick={() => setOpen(true)}>New Watch</ActionButton>
          </>
        )}
      />

      {message ? <div className="mb-4"><Notice type="success">{message}</Notice></div> : null}
      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {[
          ["Enabled watches", summary.enabled],
          ["Notifications", summary.notify],
          ["Warnings", summary.warning]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
            <div className="mt-2 text-3xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <DataTable
        minWidth={980}
        columns={[
          { key: "name", label: "Task" },
          { key: "type", label: "Type", render: (row) => titleize(row.type) },
          { key: "schedule", label: "Cron" },
          { key: "target", label: "Target", render: (row) => row.target || "all" },
          { key: "notify", label: "Notify", render: (row) => row.notify ? "Yes" : "No" },
          { key: "enabled", label: "Enabled", render: (row) => row.enabled === false ? "No" : "Yes" },
          { key: "lastStatus", label: "Last Status", render: (row) => <span className={`badge badge-${statusBadge(row.lastStatus)}`}>{titleize(row.lastStatus || "ready")}</span> },
          { key: "lastRunAt", label: "Last Run", render: (row) => humanDate(row.lastRunAt) },
          { key: "nextRunAt", label: "Next Run", render: (row) => humanDate(row.nextRunAt) },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <ActionButton variant="secondary" disabled={String(row.id || "").startsWith("default-")} onClick={() => run(row)}>Run</ActionButton>
                <ActionButton variant="secondary" disabled={String(row.id || "").startsWith("default-")} onClick={() => toggle(row)}>{row.enabled === false ? "Enable" : "Disable"}</ActionButton>
              </div>
            )
          }
        ]}
        rows={rows}
        empty="No cron tasks yet."
      />

      <h2 className="mb-3 mt-6 font-semibold">Recent Notifications</h2>
      <DataTable
        compact
        minWidth={640}
        columns={[
          { key: "type", label: "Type", render: (row) => <span className={`badge badge-${statusBadge(row.type)}`}>{titleize(row.type)}</span> },
          { key: "title", label: "Title" },
          { key: "message", label: "Message" },
          { key: "createdAt", label: "Created", render: (row) => humanDate(row.createdAt) }
        ]}
        rows={notifications}
        empty="No notifications yet."
      />

      <Modal open={open} onClose={() => setOpen(false)} title="New Auto Cron Watch" description="Checks create notifications and audit records when attention is needed.">
        <form onSubmit={create} className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="text-sm font-medium">Name</span>
            <input className="input mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            <span className="text-sm font-medium">Type</span>
            <select className="input mt-1" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              {taskTypes.map((type) => <option key={type} value={type}>{titleize(type)}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium">Cron schedule</span>
            <input className="input mt-1" value={form.schedule} onChange={(event) => setForm({ ...form, schedule: event.target.value })} />
          </label>
          <label>
            <span className="text-sm font-medium">Target</span>
            <input className="input mt-1" value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.notify} onChange={(event) => setForm({ ...form, notify: event.target.checked })} />
            <span>Send notification</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
            <span>Enabled</span>
          </label>
          <div className="md:col-span-2"><ActionButton onClick={create}>Create Watch</ActionButton></div>
        </form>
      </Modal>
    </Shell>
  );
}
