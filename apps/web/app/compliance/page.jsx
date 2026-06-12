"use client";

import { useEffect, useState } from "react";
import { ActionButton } from "../../components/ActionButton";
import { DataTable } from "../../components/DataTable";
import { Notice } from "../../components/Notice";
import { PageHeader } from "../../components/PageHeader";
import { Shell } from "../../components/Shell";
import { StatCard } from "../../components/StatCard";
import { apiFetch, humanDate } from "../../lib/api";
import { statusBadge, titleize } from "../../lib/format";

export default function CompliancePage() {
  const [overview, setOverview] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [backup, setBackup] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [loginEvents, setLoginEvents] = useState([]);
  const [auditExport, setAuditExport] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [overviewData, baselineData, backupData, sessionData, apiKeyData, loginData, exportData] = await Promise.all([
        apiFetch("/compliance/overview"),
        apiFetch("/compliance/security-baseline"),
        apiFetch("/compliance/backup-compliance"),
        apiFetch("/compliance/sessions"),
        apiFetch("/compliance/api-key-usage"),
        apiFetch("/compliance/login-history?take=50"),
        apiFetch("/compliance/audit-export?take=100")
      ]);
      setOverview(overviewData);
      setBaseline(baselineData);
      setBackup(backupData);
      setSessions(sessionData.sessions || []);
      setApiKeys(apiKeyData.keys || []);
      setLoginEvents(loginData.events || []);
      setAuditExport(exportData.export || null);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Shell>
      <PageHeader
        title="Compliance"
        description="Audit export, tamper-evident hash chain, retention, session revocation, policy controls and compliance reports."
        action={<ActionButton variant="secondary" onClick={load}>Refresh</ActionButton>}
      />

      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Audit Events" value={overview?.totals?.auditEvents || 0} />
        <StatCard label="Active Sessions" value={overview?.totals?.activeSessions || 0} />
        <StatCard label="API Keys" value={overview?.totals?.apiKeys || 0} />
        <StatCard label="Baseline Score" value={`${baseline?.score?.score ?? 0}%`} />
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Tamper-evident audit export</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">SHA-256 hash chain with masked sensitive metadata.</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs dark:bg-slate-950">
            {auditExport?.headHash || "No export hash yet"}
          </div>
        </div>
      </div>

      <h2 className="mb-3 font-semibold">Governance Controls</h2>
      <DataTable
        compact
        minWidth={760}
        columns={[
          { key: "label", label: "Control" },
          { key: "status", label: "Status", render: (row) => <span className={`badge badge-${statusBadge(row.status)}`}>{titleize(row.status)}</span> },
          { key: "endpoint", label: "Endpoint" }
        ]}
        rows={overview?.controls || []}
        empty="No compliance controls."
      />

      <h2 className="mb-3 mt-6 font-semibold">Security Baseline</h2>
      <DataTable
        compact
        minWidth={820}
        columns={[
          { key: "label", label: "Control" },
          { key: "status", label: "Status", render: (row) => <span className={`badge badge-${statusBadge(row.status)}`}>{titleize(row.status)}</span> },
          { key: "evidence", label: "Evidence" }
        ]}
        rows={baseline?.controls || []}
        empty="No baseline controls."
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div>
          <h2 className="mb-3 font-semibold">API Key Usage</h2>
          <DataTable
            compact
            minWidth={720}
            columns={[
              { key: "name", label: "Key" },
              { key: "owner", label: "Owner", render: (row) => row.owner?.email || "-" },
              { key: "status", label: "Status", render: (row) => <span className={`badge badge-${statusBadge(row.status)}`}>{titleize(row.status)}</span> },
              { key: "lastUsedAt", label: "Last Used", render: (row) => humanDate(row.lastUsedAt) }
            ]}
            rows={apiKeys}
            empty="No API keys."
          />
        </div>

        <div>
          <h2 className="mb-3 font-semibold">Session Inventory</h2>
          <DataTable
            compact
            minWidth={720}
            columns={[
              { key: "user", label: "User", render: (row) => row.user?.email || "-" },
              { key: "status", label: "Status", render: (row) => <span className={`badge badge-${statusBadge(row.status)}`}>{titleize(row.status)}</span> },
              { key: "ipAddress", label: "IP" },
              { key: "expiresAt", label: "Expires", render: (row) => humanDate(row.expiresAt) }
            ]}
            rows={sessions}
            empty="No sessions."
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div>
          <h2 className="mb-3 font-semibold">Backup Compliance</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Jobs" value={backup?.summary?.jobs || 0} />
            <StatCard label="Backups" value={backup?.summary?.backups || 0} />
            <StatCard label="Encrypted" value={`${backup?.summary?.encryptionRate ?? 100}%`} />
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-semibold">Login History</h2>
          <DataTable
            compact
            minWidth={720}
            columns={[
              { key: "action", label: "Action" },
              { key: "user", label: "Actor", render: (row) => row.user?.email || row.userId || "system" },
              { key: "ipAddress", label: "IP" },
              { key: "createdAt", label: "Time", render: (row) => humanDate(row.createdAt) }
            ]}
            rows={loginEvents}
            empty="No login history."
          />
        </div>
      </div>
    </Shell>
  );
}
