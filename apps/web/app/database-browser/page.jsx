"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { Notice } from "../../components/Notice";
import { apiFetch } from "../../lib/api";

export default function DatabaseBrowserPage() {
  const [servers, setServers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tree, setTree] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => { apiFetch("/database-browser/servers").then((data) => { setServers(data.servers || []); setSelected(data.servers?.[0] || null); }).catch((err) => setError(err.message)); }, []);
  useEffect(() => { if (selected?.id) apiFetch(`/database-browser/servers/${selected.id}/tree`).then((data) => setTree(data.tree || [])).catch((err) => setError(err.message)); }, [selected]);

  return (
    <Shell>
      <PageHeader title="Database Browser" description="Browse servers, databases, schemas and tables from the web panel." />
      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="card">
          <h2 className="mb-3 font-semibold">Servers</h2>
          <div className="space-y-2">
            {servers.map((server) => <button key={server.id} onClick={() => setSelected(server)} className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${selected?.id === server.id ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 dark:border-slate-700"}`}>{server.name}<span className="block text-xs opacity-70">{server.engine}://{server.host}:{server.port}</span></button>)}
            {!servers.length ? <p className="text-sm text-slate-500">No database servers. Add one from Databases.</p> : null}
          </div>
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold">Tree</h2>
          {tree.length ? <ul className="space-y-2 text-sm">{tree.map((item) => <li key={item.name} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">{item.type}: <strong>{item.name}</strong></li>)}</ul> : <Notice>Database tree is empty. Engine adapters can expand schemas/tables here.</Notice>}
        </div>
      </div>
    </Shell>
  );
}
