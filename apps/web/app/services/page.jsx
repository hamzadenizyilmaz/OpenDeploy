"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { apiFetch } from "../../lib/api";

export default function ServicesPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  async function load() { try { const data = await apiFetch("/services"); setRows(data.services || []); setError(""); } catch (err) { setError(err.message); } }
  useEffect(() => { load(); }, []);
  async function action(service, verb) { try { await apiFetch(`/services/${service}/${verb}`, { method: "POST", body: {} }); await load(); } catch (err) { setError(err.message); } }
  return (
    <Shell>
      <PageHeader title="Services" description="Start, stop, restart and inspect system services." action={<ActionButton variant="secondary" onClick={load}>Refresh</ActionButton>} />
      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}
      <DataTable columns={[{ key: "service", label: "Service" }, { key: "status", label: "Status", render: (row) => <span className={`badge badge-${row.status || "unknown"}`}>{row.status || "unknown"}</span> }, { key: "enabled", label: "Enabled", render: (row) => String(row.enabled ?? "-") }, { key: "actions", label: "Actions", render: (row) => <div className="flex gap-2"><ActionButton variant="secondary" onClick={() => action(row.service, "start")}>Start</ActionButton><ActionButton variant="secondary" onClick={() => action(row.service, "restart")}>Restart</ActionButton><ActionButton variant="danger" onClick={() => action(row.service, "stop")}>Stop</ActionButton></div> }]} rows={rows} empty="No services returned by the agent." />
    </Shell>
  );
}
