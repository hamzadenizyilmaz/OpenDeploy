"use client";

import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { apiFetch, humanDate } from "../../lib/api";
import { titleize, statusBadge } from "../../lib/format";

export default function AuditPage() {
  const [rows, setRows] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [summary, setSummary] = useState(null);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [error, setError] = useState("");

  async function load(nextSeverity = severity) {
    try {
      const data = await apiFetch(`/audit?severity=${encodeURIComponent(nextSeverity)}&take=300`);
      setRows(data.logs || []);
      setCatalog(data.catalog || []);
      setSummary(data.summary || null);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load("all");
  }, []);

  const categories = useMemo(() => ["all", ...new Set(rows.map((row) => row.category).filter(Boolean))], [rows]);
  const [category, setCategory] = useState("all");
  const filtered = useMemo(() => rows.filter((row) => {
    const text = `${row.label} ${row.action} ${row.resource} ${row.actor} ${row.ipAddress} ${row.summary}`.toLowerCase();
    return (category === "all" || row.category === category) && text.includes(query.toLowerCase());
  }), [category, query, rows]);

  function changeSeverity(value) {
    setSeverity(value);
    load(value);
  }

  return (
    <Shell>
      <PageHeader
        title="Audit Logs"
        description="Security, admin, deployment, DNS, SQL, terminal, file and firewall events with masked metadata."
        action={<ActionButton variant="secondary" onClick={() => load(severity)}>Refresh</ActionButton>}
      />

      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-slate-500 dark:text-slate-400">Events</div>
          <div className="mt-2 text-3xl font-bold">{summary?.total || rows.length}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-slate-500 dark:text-slate-400">Warnings</div>
          <div className="mt-2 text-3xl font-bold">{summary?.bySeverity?.warning || 0}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-slate-500 dark:text-slate-400">Catalog</div>
          <div className="mt-2 text-3xl font-bold">{catalog.length}</div>
        </div>
      </div>

      <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_180px_220px]">
        <input className="input rounded-lg" placeholder="Search action, actor, IP or metadata" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select className="input rounded-lg" value={severity} onChange={(event) => changeSeverity(event.target.value)}>
          {["all", "info", "success", "warning", "error", "critical"].map((item) => <option key={item} value={item}>{titleize(item)}</option>)}
        </select>
        <select className="input rounded-lg" value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => <option key={item} value={item}>{titleize(item)}</option>)}
        </select>
      </div>

      <DataTable
        minWidth={1120}
        columns={[
          { key: "severity", label: "Severity", render: (row) => <span className={`badge badge-${statusBadge(row.severity)}`}>{titleize(row.severity)}</span> },
          { key: "label", label: "Event" },
          { key: "category", label: "Category" },
          { key: "actor", label: "Actor" },
          { key: "ipAddress", label: "IP" },
          { key: "resource", label: "Resource", render: (row) => titleize(row.resource) },
          { key: "summary", label: "Details", render: (row) => <span className="block max-w-md truncate" title={row.summary}>{row.summary || "-"}</span> },
          { key: "createdAt", label: "Time", render: (row) => humanDate(row.createdAt) }
        ]}
        rows={filtered}
        empty="No audit logs yet."
      />

      <h2 className="mb-3 mt-6 font-semibold">Event Catalog</h2>
      <DataTable
        compact
        minWidth={720}
        columns={[
          { key: "label", label: "Event" },
          { key: "category", label: "Category" },
          { key: "severity", label: "Severity", render: (row) => <span className={`badge badge-${statusBadge(row.severity)}`}>{titleize(row.severity)}</span> },
          { key: "description", label: "Description" }
        ]}
        rows={catalog}
        empty="No event catalog."
      />
    </Shell>
  );
}
