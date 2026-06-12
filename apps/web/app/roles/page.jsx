"use client";

import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { apiFetch } from "../../lib/api";
import { titleize, PERMISSION_LABELS } from "../../lib/format";

export default function RolesPage() {
  const [rows, setRows] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "support_engineer", description: "Support engineer with read-only operations access.", permissions: ["monitoring.read", "audit.read"] });

  async function load() {
    try {
      const [roleData, permissionData] = await Promise.all([apiFetch("/roles"), apiFetch("/roles/permissions")]);
      setRows(roleData.roles || []);
      setPermissions(permissionData.permissions || []);
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
      await apiFetch("/roles", { method: "POST", body: form });
      setMessage("Custom role created.");
      setOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function toggle(key) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(key) ? current.permissions.filter((item) => item !== key) : [...current.permissions, key]
    }));
  }

  const groups = useMemo(() => permissions.reduce((acc, permission) => {
    const group = permission.key.split(".")[0];
    acc[group] = acc[group] || [];
    acc[group].push(permission);
    return acc;
  }, {}), [permissions]);

  const visiblePermissions = activeGroup === "all" ? permissions : groups[activeGroup] || [];

  return (
    <Shell>
      <PageHeader title="Roles" description="Create custom roles from a controlled permission catalog with short descriptions for every permission." action={<ActionButton onClick={() => setOpen(true)}>New Role</ActionButton>} />

      {message ? <div className="mb-4"><Notice type="success">{message}</Notice></div> : null}
      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

      <DataTable
        minWidth={820}
        columns={[
          { key: "name", label: "Role", render: (row) => titleize(row.name) },
          { key: "description", label: "Description" },
          { key: "users", label: "Users", render: (row) => row.users?.length || 0 },
          { key: "permissions", label: "Permissions", render: (row) => row.permissions?.length || 0 },
          { key: "isSystem", label: "Type", render: (row) => <span className={`badge badge-${row.isSystem ? "running" : "warning"}`}>{row.isSystem ? "System" : "Custom"}</span> }
        ]}
        rows={rows}
        empty="No roles. Run seed."
      />

      <h2 className="mb-3 mt-6 font-semibold">Permission Catalog</h2>
      <div className="mb-4 flex flex-wrap gap-2">
        {["all", ...Object.keys(groups)].map((group) => (
          <button
            key={group}
            className={`rounded-lg border px-3 py-2 text-sm transition ${activeGroup === group ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"}`}
            onClick={() => setActiveGroup(group)}
            type="button"
          >
            {titleize(group)}
          </button>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {visiblePermissions.map((permission) => (
          <div key={permission.key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="font-medium">{PERMISSION_LABELS[permission.key] || titleize(permission.key)}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400"><code>{permission.key}</code> - {permission.description}</div>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Custom Role" description="Use lowercase keys; permissions are selected from the controlled catalog.">
        <form onSubmit={create} className="grid gap-4">
          <label>
            <span className="text-sm font-medium">Role key</span>
            <input className="input mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            <span className="text-sm font-medium">Description</span>
            <input className="input mt-1" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <div className="grid max-h-96 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            {permissions.map((permission) => (
              <label key={permission.key} className="flex gap-2 rounded-lg p-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                <input type="checkbox" checked={form.permissions.includes(permission.key)} onChange={() => toggle(permission.key)} />
                <span>
                  <b>{PERMISSION_LABELS[permission.key] || titleize(permission.key)}</b>
                  <br />
                  <span className="text-xs text-slate-500">{permission.description}</span>
                </span>
              </label>
            ))}
          </div>
          <ActionButton onClick={create}>Create Role</ActionButton>
        </form>
      </Modal>
    </Shell>
  );
}
