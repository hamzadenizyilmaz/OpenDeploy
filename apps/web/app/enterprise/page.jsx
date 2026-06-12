"use client";

import { useEffect, useState } from "react";
import { ActionButton } from "../../components/ActionButton";
import { DataTable } from "../../components/DataTable";
import { Notice } from "../../components/Notice";
import { PageHeader } from "../../components/PageHeader";
import { Shell } from "../../components/Shell";
import { StatCard } from "../../components/StatCard";
import { apiFetch } from "../../lib/api";
import { statusBadge, titleize } from "../../lib/format";

function JsonPanel({ title, data }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(data || {}, null, 2)}</pre>
    </div>
  );
}

export default function EnterprisePage() {
  const [overview, setOverview] = useState(null);
  const [ha, setHa] = useState(null);
  const [dns, setDns] = useState(null);
  const [waf, setWaf] = useState(null);
  const [dr, setDr] = useState(null);
  const [queues, setQueues] = useState(null);
  const [siem, setSiem] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [overviewData, haData, dnsData, wafData, drData, queueData, siemData] = await Promise.all([
        apiFetch("/enterprise/overview"),
        apiFetch("/enterprise/ha"),
        apiFetch("/enterprise/dns"),
        apiFetch("/enterprise/waf"),
        apiFetch("/enterprise/dr"),
        apiFetch("/enterprise/queues"),
        apiFetch("/enterprise/siem")
      ]);
      setOverview(overviewData);
      setHa(haData);
      setDns(dnsData);
      setWaf(wafData);
      setDr(drData);
      setQueues(queueData);
      setSiem(siemData);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const capabilities = [
    ...(overview?.scaleCapabilities || []),
    ...(overview?.enterpriseCapabilities || [])
  ];

  return (
    <Shell>
      <PageHeader
        title="Enterprise Ops"
        description="Scale, automation, SSO/SCIM, HA, DNSSEC, WAF, SIEM, DR and support-bundle control surfaces."
        action={<ActionButton variant="secondary" onClick={load}>Refresh</ActionButton>}
      />

      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

      <div className="mb-6 grid gap-4 md:grid-cols-5">
        <StatCard label="Projects" value={overview?.inventory?.projects || 0} />
        <StatCard label="Users" value={overview?.inventory?.users || 0} />
        <StatCard label="Deployments" value={overview?.inventory?.deployments || 0} />
        <StatCard label="Backups" value={overview?.inventory?.backups || 0} />
        <StatCard label="Next" value={overview?.nextTrack || "v2.2.0"} />
      </div>

      <h2 className="mb-3 font-semibold">Capabilities</h2>
      <DataTable
        compact
        minWidth={860}
        columns={[
          { key: "label", label: "Capability" },
          { key: "status", label: "Status", render: (row) => <span className={`badge badge-${statusBadge(row.status)}`}>{titleize(row.status)}</span> },
          { key: "endpoint", label: "Endpoint" }
        ]}
        rows={capabilities}
        empty="No enterprise capabilities."
      />

      <h2 className="mb-3 mt-6 font-semibold">Release Readiness</h2>
      <DataTable
        compact
        minWidth={820}
        columns={[
          { key: "label", label: "Gate" },
          { key: "status", label: "Status", render: (row) => <span className={`badge badge-${statusBadge(row.status)}`}>{titleize(row.status)}</span> },
          { key: "detail", label: "Detail" }
        ]}
        rows={overview?.readiness || []}
        empty="No readiness gates."
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <JsonPanel title="HA API Profile" data={ha} />
        <JsonPanel title="HA / Multi-region DNS" data={dns} />
        <JsonPanel title="Enterprise WAF" data={waf} />
        <JsonPanel title="Queue Isolation" data={queues} />
        <JsonPanel title="SIEM Export" data={siem} />
        <JsonPanel title="DR Runbooks" data={dr} />
      </div>
    </Shell>
  );
}
