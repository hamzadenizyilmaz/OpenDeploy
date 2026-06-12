"use client";

import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { apiFetch, humanDate } from "../../lib/api";
import { titleize } from "../../lib/format";

function stringifyValue(setting) {
  if (Array.isArray(setting.value)) return setting.value.join(", ");
  if (typeof setting.value === "object" && setting.value !== null) return JSON.stringify(setting.value);
  return String(setting.value ?? "");
}

function settingTitle(setting) {
  if (setting.label) return setting.label;
  const key = String(setting.key || "");
  const parts = key.split(".");
  return titleize(parts[parts.length - 1] || key);
}

function settingScope(setting) {
  const key = String(setting.key || "");
  const scope = key.includes(".") ? key.split(".")[0] : setting.group;
  return titleize(scope || "Panel");
}

function coerceDraft(setting, value) {
  if (setting.type === "boolean") return value === true || value === "true";
  if (setting.type === "number") return Number(value);
  if (setting.type === "csv") return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  return value;
}

function SettingControl({ setting, value, onChange }) {
  if (setting.type === "boolean") {
    return (
      <label className="inline-flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
        <span className="text-sm font-medium">{value === true || value === "true" ? "Enabled" : "Disabled"}</span>
        <input className="h-4 w-4" type="checkbox" checked={value === true || value === "true"} onChange={(event) => onChange(event.target.checked)} />
      </label>
    );
  }

  if (setting.type === "select") {
    return (
      <select className="input rounded-lg" value={value} onChange={(event) => onChange(event.target.value)}>
        {(setting.options || []).map((option) => <option key={option} value={option}>{titleize(option)}</option>)}
      </select>
    );
  }

  if (setting.type === "number") {
    return (
      <input
        className="input rounded-lg"
        type="number"
        min={setting.min}
        max={setting.max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <input
      className="input rounded-lg"
      type={setting.type === "secret" ? "password" : "text"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={setting.type === "csv" ? "value1, value2" : undefined}
    />
  );
}

export default function SettingsPage() {
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [activeGroup, setActiveGroup] = useState("All");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const data = await apiFetch("/settings");
      const settings = data.settings || [];
      setRows(settings);
      setDrafts(Object.fromEntries(settings.map((setting) => [setting.key, stringifyValue(setting)])));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => ["All", ...new Set(rows.map((row) => row.group || "Custom"))], [rows]);
  const visibleRows = activeGroup === "All" ? rows : rows.filter((row) => row.group === activeGroup);

  async function save(setting) {
    setError("");
    setMessage("");
    try {
      await apiFetch("/settings", {
        method: "PUT",
        body: {
          key: setting.key,
          value: coerceDraft(setting, drafts[setting.key])
        }
      });
      setMessage(`${settingTitle(setting)} saved.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Settings"
        description="Typed control for security, DNS, backups, notifications, proxy and update behavior."
        action={<ActionButton variant="secondary" onClick={load}>Refresh</ActionButton>}
      />

      {message ? <div className="mb-4"><Notice type="success">{message}</Notice></div> : null}
      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {groups.map((group) => (
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

      <div className="grid gap-3">
        {visibleRows.map((setting) => (
          <div key={setting.key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(240px,420px)_auto] xl:items-center">
              <div>
                <div className="font-semibold">{settingTitle(setting)}</div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{setting.description}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{settingScope(setting)}</span>
                  <span>{titleize(setting.type)}</span>
                  <span>{setting.updatedAt ? humanDate(setting.updatedAt) : "Default"}</span>
                  <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 dark:bg-slate-950 dark:text-slate-400">{setting.key}</code>
                </div>
              </div>
              <SettingControl
                setting={setting}
                value={drafts[setting.key] ?? ""}
                onChange={(value) => setDrafts((current) => ({ ...current, [setting.key]: value }))}
              />
              <ActionButton variant="secondary" onClick={() => save(setting)}>Save</ActionButton>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
