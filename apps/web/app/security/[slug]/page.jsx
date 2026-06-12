"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Bot, Gauge, Plus, Shield, Trash2 } from "lucide-react";
import { Shell } from "../../../components/Shell";
import { PageHeader } from "../../../components/PageHeader";
import { DataTable } from "../../../components/DataTable";
import { Modal } from "../../../components/Modal";
import { Notice } from "../../../components/Notice";
import { ActionButton } from "../../../components/ActionButton";
import { apiFetch, humanDate } from "../../../lib/api";
import { titleize } from "../../../lib/format";

const policyNav = [
  { slug: "waf-rules", label: "WAF Rules", icon: Shield },
  { slug: "advanced-rules", label: "Advanced Rules", icon: Shield },
  { slug: "rate-limiting", label: "Rate Limiting", icon: Gauge },
  { slug: "challenge-settings", label: "Challenge Settings", icon: Bot }
];

const fieldSets = {
  "waf-rules": [
    ["name", "Name", "text"],
    ["category", "Category", "text"],
    ["mode", "Mode", "select", ["monitoring", "challenge", "blocking"]],
    ["action", "Action", "select", ["allow", "log", "challenge", "managed_challenge", "block"]],
    ["severity", "Severity", "select", ["info", "low", "medium", "high", "critical"]],
    ["pattern", "Pattern", "text"],
    ["description", "Description", "textarea"],
    ["enabled", "Enabled", "boolean"]
  ],
  "advanced-rules": [
    ["name", "Name", "text"],
    ["signal", "Signal", "text"],
    ["action", "Action", "select", ["score", "sanitize", "challenge", "block", "normalize_then_block"]],
    ["severity", "Severity", "select", ["info", "low", "medium", "high", "critical"]],
    ["description", "Description", "textarea"],
    ["enabled", "Enabled", "boolean"]
  ],
  "rate-limiting": [
    ["name", "Name", "text"],
    ["scope", "Scope", "text"],
    ["limit", "Limit", "number"],
    ["windowSeconds", "Window seconds", "number"],
    ["burst", "Burst", "number"],
    ["action", "Action", "select", ["log", "429", "queue", "challenge_then_block", "block"]],
    ["description", "Description", "textarea"],
    ["enabled", "Enabled", "boolean"]
  ],
  "challenge-settings": [
    ["name", "Name", "text"],
    ["route", "Route(s)", "text"],
    ["trigger", "Trigger", "text"],
    ["action", "Action", "select", ["managed_challenge", "turnstile", "recaptcha", "hcaptcha", "temporary_403", "block"]],
    ["severity", "Severity", "select", ["info", "low", "medium", "high", "critical"]],
    ["description", "Description", "textarea"],
    ["enabled", "Enabled", "boolean"]
  ]
};

const emptyItem = {
  name: "",
  category: "",
  mode: "blocking",
  action: "block",
  severity: "medium",
  pattern: "",
  signal: "",
  scope: "",
  route: "",
  trigger: "",
  limit: 60,
  windowSeconds: 60,
  burst: 10,
  description: "",
  enabled: true
};

function coerceItem(fields, item) {
  const next = {};
  for (const [key,, type] of fields) {
    if (type === "number") next[key] = Number(item[key] || 0);
    else if (type === "boolean") next[key] = item[key] === true || item[key] === "true";
    else next[key] = item[key] ?? "";
  }
  return next;
}

function SettingInput({ name, value, onChange }) {
  if (typeof value === "boolean") {
    return (
      <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
        <span className="text-sm font-medium">{value ? "Enabled" : "Disabled"}</span>
        <input className="h-4 w-4" type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
      </label>
    );
  }
  if (typeof value === "number") {
    return <input className="input rounded-lg" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />;
  }
  return <input className="input rounded-lg" value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder={titleize(name)} />;
}

function ItemField({ field, value, onChange }) {
  const [key, label, type, options] = field;
  if (type === "boolean") {
    return (
      <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
        <span className="text-sm font-medium">{label}</span>
        <input className="h-4 w-4" type="checkbox" checked={value === true || value === "true"} onChange={(event) => onChange(key, event.target.checked)} />
      </label>
    );
  }
  if (type === "select") {
    return (
      <label>
        <span className="text-sm font-medium">{label}</span>
        <select className="input mt-1 rounded-lg" value={value ?? ""} onChange={(event) => onChange(key, event.target.value)}>
          {(options || []).map((option) => <option key={option} value={option}>{titleize(option)}</option>)}
        </select>
      </label>
    );
  }
  if (type === "textarea") {
    return (
      <label className="md:col-span-2">
        <span className="text-sm font-medium">{label}</span>
        <textarea className="input mt-1 min-h-24 rounded-lg" value={value ?? ""} onChange={(event) => onChange(key, event.target.value)} />
      </label>
    );
  }
  return (
    <label>
      <span className="text-sm font-medium">{label}</span>
      <input className="input mt-1 rounded-lg" type={type} value={value ?? ""} onChange={(event) => onChange(key, type === "number" ? Number(event.target.value) : event.target.value)} />
    </label>
  );
}

export default function SecurityPolicyPage() {
  const params = useParams();
  const slug = params.slug;
  const [policy, setPolicy] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState({});
  const [itemDraft, setItemDraft] = useState(emptyItem);
  const [editingItem, setEditingItem] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fields = fieldSets[slug] || fieldSets["waf-rules"];
  const activeNav = policyNav.find((item) => item.slug === slug);

  async function load() {
    try {
      const data = await apiFetch(`/security/${slug}`);
      setPolicy(data.policy);
      setSettingsDraft(data.policy?.settings || {});
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [slug]);

  const stats = useMemo(() => {
    const items = policy?.items || [];
    return {
      total: items.length,
      enabled: items.filter((item) => item.enabled !== false).length,
      critical: items.filter((item) => item.severity === "critical").length,
      disabled: items.filter((item) => item.enabled === false).length
    };
  }, [policy]);

  function openCreate() {
    setEditingItem(null);
    setItemDraft({ ...emptyItem, action: slug === "rate-limiting" ? "429" : slug === "challenge-settings" ? "managed_challenge" : "block" });
    setOpen(true);
  }

  function openEdit(item) {
    setEditingItem(item);
    setItemDraft({ ...emptyItem, ...item });
    setOpen(true);
  }

  async function saveSettings() {
    setError("");
    setMessage("");
    try {
      const data = await apiFetch(`/security/${slug}/settings`, { method: "PUT", body: { settings: settingsDraft } });
      setPolicy(data.policy);
      setMessage("Security policy settings saved.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveItem(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const body = coerceItem(fields, itemDraft);
      const path = editingItem ? `/security/${slug}/items/${editingItem.id}` : `/security/${slug}/items`;
      const method = editingItem ? "PUT" : "POST";
      const data = await apiFetch(path, { method, body });
      setPolicy(data.policy);
      setOpen(false);
      setMessage(editingItem ? "Security policy item updated." : "Security policy item created.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteItem(item) {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    setError("");
    setMessage("");
    try {
      const data = await apiFetch(`/security/${slug}/items/${item.id}`, { method: "DELETE" });
      setPolicy(data.policy);
      setMessage("Security policy item deleted.");
    } catch (err) {
      setError(err.message);
    }
  }

  const columns = [
    { key: "name", label: "Name" },
    ...(slug === "waf-rules" ? [{ key: "category", label: "Category" }, { key: "mode", label: "Mode", render: (row) => titleize(row.mode) }] : []),
    ...(slug === "advanced-rules" ? [{ key: "signal", label: "Signal" }] : []),
    ...(slug === "rate-limiting" ? [
      { key: "scope", label: "Scope" },
      { key: "limit", label: "Limit", render: (row) => `${row.limit} / ${row.windowSeconds}s` },
      { key: "burst", label: "Burst" }
    ] : []),
    ...(slug === "challenge-settings" ? [{ key: "route", label: "Route" }, { key: "trigger", label: "Trigger" }] : []),
    { key: "action", label: "Action", render: (row) => titleize(row.action) },
    { key: "severity", label: "Severity", render: (row) => <span className={`badge badge-${row.severity === "critical" ? "failed" : row.severity === "high" ? "warning" : "info"}`}>{titleize(row.severity)}</span> },
    { key: "enabled", label: "State", render: (row) => <span className={`badge badge-${row.enabled === false ? "stopped" : "running"}`}>{row.enabled === false ? "Disabled" : "Enabled"}</span> },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <ActionButton variant="secondary" onClick={() => openEdit(row)}>Edit</ActionButton>
          <ActionButton variant="danger" onClick={() => deleteItem(row)}><Trash2 className="mr-1 inline h-4 w-4" />Delete</ActionButton>
        </div>
      )
    }
  ];

  return (
    <Shell>
      <PageHeader
        title={policy?.title || activeNav?.label || "Security Policy"}
        description={policy?.description || "Manage this security policy from a dedicated slug."}
        action={<ActionButton onClick={openCreate}><Plus className="mr-2 inline h-4 w-4" />New Rule</ActionButton>}
      />

      {message ? <div className="mb-4"><Notice type="success">{message}</Notice></div> : null}
      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {policyNav.map((item) => (
          <Link
            key={item.slug}
            href={`/security/${item.slug}`}
            className={`rounded-lg border px-3 py-2 text-sm transition ${item.slug === slug ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total", stats.total, "Configured rules"],
          ["Enabled", stats.enabled, "Active protections"],
          ["Critical", stats.critical, "Critical severity controls"],
          ["Disabled", stats.disabled, "Inactive entries"]
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
            <div className="mt-2 text-2xl font-bold">{value}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>
          </div>
        ))}
      </div>

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Policy Settings</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">Updated {humanDate(policy?.updatedAt)}</span>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(settingsDraft).map(([key, value]) => (
              <label key={key}>
                <span className="text-sm font-medium">{titleize(key)}</span>
                <div className="mt-1">
                  <SettingInput name={key} value={value} onChange={(next) => setSettingsDraft((current) => ({ ...current, [key]: next }))} />
                </div>
              </label>
            ))}
          </div>
          <div className="mt-4">
            <ActionButton variant="secondary" onClick={saveSettings}>Save Settings</ActionButton>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Rules</h2>
        <DataTable columns={columns} rows={policy?.items || []} minWidth={980} empty="No security policy items." />
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title={editingItem ? "Edit Security Rule" : "New Security Rule"} description="Values are validated server-side and written to the audit log.">
        <form onSubmit={saveItem} className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <ItemField
              key={field[0]}
              field={field}
              value={itemDraft[field[0]]}
              onChange={(key, value) => setItemDraft((current) => ({ ...current, [key]: value }))}
            />
          ))}
          <div className="md:col-span-2">
            <ActionButton type="submit">{editingItem ? "Save Rule" : "Create Rule"}</ActionButton>
          </div>
        </form>
      </Modal>
    </Shell>
  );
}
