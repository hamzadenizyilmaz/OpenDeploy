"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { ActionButton } from "../../components/ActionButton";
import { Notice } from "../../components/Notice";
import { apiFetch } from "../../lib/api";

export default function ProjectsPage() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/projects");
      setRows(data.projects || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function action(id, type) {
    setError("");
    try {
      await apiFetch(`/projects/${id}/${type}`, { method: "POST", body: {} });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const filtered = useMemo(() => rows.filter((item) => `${item.name} ${item.framework} ${item.repositoryUrl || ""}`.toLowerCase().includes(query.toLowerCase())), [rows, query]);

  return (
    <Shell>
      <PageHeader
        title="Projects"
        description="Create, deploy, rebuild and monitor JavaScript applications."
        action={<Link href="/projects/new" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-950">New Project</Link>}
      />
      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}
      <div className="card mb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input className="input md:max-w-sm" placeholder="Search projects..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="text-sm text-slate-500 dark:text-slate-400">{loading ? "Loading..." : `${filtered.length} projects`}</div>
        </div>
      </div>
      <DataTable
        columns={[
          { key: "name", label: "Name" },
          { key: "framework", label: "Framework" },
          { key: "port", label: "Port" },
          { key: "status", label: "Status", render: (row) => <span className={`badge badge-${row.status || "created"}`}>{row.status || "created"}</span> },
          { key: "actions", label: "Actions", render: (row) => <div className="flex flex-wrap gap-2"><ActionButton variant="secondary" onClick={() => action(row.id, "start")}>Start</ActionButton><ActionButton variant="secondary" onClick={() => action(row.id, "stop")}>Stop</ActionButton><ActionButton onClick={() => action(row.id, "deploy")}>Deploy</ActionButton></div> }
        ]}
        rows={filtered}
        empty="No projects yet. Click New Project to create one."
      />
    </Shell>
  );
}
