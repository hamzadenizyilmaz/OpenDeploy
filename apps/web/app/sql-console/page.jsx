"use client";

import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { apiFetch } from "../../lib/api";
import { ENGINE_LABELS, titleize } from "../../lib/format";

export default function SqlConsolePage() {
  const [servers, setServers] = useState([]);
  const [snippets, setSnippets] = useState([]);
  const [serverId, setServerId] = useState("");
  const [activeGroup, setActiveGroup] = useState("All");
  const [query, setQuery] = useState("select now();");
  const [limit, setLimit] = useState(100);
  const [confirmDangerous, setConfirmDangerous] = useState(false);
  const [readOnly, setReadOnly] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([apiFetch("/databases"), apiFetch("/database-query/snippets")])
      .then(([databaseData, snippetsData]) => {
        setServers(databaseData.servers || []);
        setServerId(databaseData.servers?.[0]?.id || "");
        setSnippets(snippetsData.snippets || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  const groups = useMemo(() => ["All", ...new Set(snippets.map((snippet) => snippet.group || titleize(snippet.engine)))], [snippets]);
  const visibleSnippets = activeGroup === "All" ? snippets : snippets.filter((snippet) => (snippet.group || titleize(snippet.engine)) === activeGroup);
  const selectedServer = servers.find((server) => server.id === serverId);

  async function execute(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    try {
      const data = await apiFetch("/database-query/execute", {
        method: "POST",
        body: { serverId, query, confirmDangerous, readOnly, limit: Number(limit) }
      });
      setResult(data.result);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <PageHeader title="SQL Console" description="Audited SQL snippets with read-only guard, result limits and dangerous-query confirmation." />

      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

      <div className="mb-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Ready Snippets</h2>
            <span className="text-xs text-slate-500">{visibleSnippets.length} snippet(s)</span>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {groups.map((group) => (
              <button
                key={group}
                className={`rounded-lg border px-3 py-1.5 text-sm ${activeGroup === group ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"}`}
                onClick={() => setActiveGroup(group)}
                type="button"
              >
                {group}
              </button>
            ))}
          </div>
          <div className="grid max-h-96 gap-2 overflow-y-auto">
            {visibleSnippets.map((snippet) => (
              <button
                key={`${snippet.group}-${snippet.name}`}
                className="rounded-lg border border-slate-200 p-3 text-left text-sm transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                onClick={() => setQuery(snippet.query)}
                type="button"
              >
                <div className="font-medium">{snippet.name}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{snippet.group || titleize(snippet.engine)}</div>
              </button>
            ))}
          </div>
        </section>

        <form onSubmit={execute} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-4 md:grid-cols-[1fr_160px]">
            <label>
              <span className="text-sm font-medium">Server</span>
              <select className="input mt-1 rounded-lg" value={serverId} onChange={(event) => setServerId(event.target.value)}>
                {servers.map((server) => <option key={server.id} value={server.id}>{server.name} ({ENGINE_LABELS[server.engine] || server.engine})</option>)}
              </select>
            </label>
            <label>
              <span className="text-sm font-medium">Limit</span>
              <input className="input mt-1 rounded-lg" type="number" min="1" max="1000" value={limit} onChange={(event) => setLimit(event.target.value)} />
            </label>
          </div>
          <div className="mt-4">
            <label>
              <span className="text-sm font-medium">SQL</span>
              <textarea className="input mt-1 min-h-72 rounded-lg font-mono text-sm" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={readOnly} onChange={(event) => setReadOnly(event.target.checked)} />
                <span>Read-only mode</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={confirmDangerous} onChange={(event) => setConfirmDangerous(event.target.checked)} />
                <span>Confirm dangerous SQL</span>
              </label>
            </div>
            <ActionButton disabled={!serverId} onClick={execute}>Run Query</ActionButton>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Target: {selectedServer ? `${selectedServer.host}:${selectedServer.port}` : "No server selected"}
          </div>
        </form>
      </div>

      {result ? (
        <section>
          {result.note ? <div className="mb-3"><Notice>{result.note}</Notice></div> : null}
          <DataTable
            minWidth={640}
            columns={(result.columns || []).map((key) => ({ key, label: titleize(key) }))}
            rows={result.rows || []}
            empty="Query returned no rows."
          />
        </section>
      ) : null}
    </Shell>
  );
}
