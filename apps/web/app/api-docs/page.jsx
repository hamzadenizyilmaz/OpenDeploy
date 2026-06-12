"use client";

import { Copy, KeyRound, ShieldCheck, TerminalSquare } from "lucide-react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";

const endpoints = [
  { id: "projects-list", method: "GET", path: "/api/projects", scope: "Projects", description: "List deployable projects and repository metadata." },
  { id: "deployments-list", method: "GET", path: "/api/deployments", scope: "Deployments", description: "Read deployment history, status and release notes." },
  { id: "deployments-create", method: "POST", path: "/api/deployments", scope: "Deployments", description: "Start a controlled deployment from an automation pipeline." },
  { id: "domains-list", method: "GET", path: "/api/domains", scope: "Network", description: "Read domains, DNS mode and certificate status." },
  { id: "dns-list", method: "GET", path: "/api/dns/zones", scope: "DNS", description: "List managed DNS zones and records." },
  { id: "monitoring", method: "GET", path: "/api/monitoring/overview", scope: "Monitoring", description: "Read host health, services, resources and active alerts." },
  { id: "backups", method: "GET", path: "/api/backups", scope: "Backups", description: "Read backup jobs, providers and retention state." },
  { id: "audit", method: "GET", path: "/api/audit", scope: "Security", description: "Read audit events for compliance review." },
  { id: "compliance-overview", method: "GET", path: "/api/compliance/overview", scope: "Compliance", description: "Read compliance control status and governance totals." },
  { id: "compliance-export", method: "GET", path: "/api/compliance/audit-export", scope: "Compliance", description: "Export masked audit events with a tamper-evident SHA-256 hash chain." },
  { id: "compliance-sessions", method: "GET", path: "/api/compliance/sessions", scope: "Compliance", description: "Read login sessions and revocation state." },
  { id: "compliance-revoke", method: "POST", path: "/api/compliance/sessions/:id/revoke", scope: "Compliance", description: "Revoke a user session and write audit evidence." },
  { id: "enterprise-overview", method: "GET", path: "/api/enterprise/overview", scope: "Enterprise", description: "Read v1.5/v2.0 enterprise capability status." },
  { id: "enterprise-ha", method: "GET", path: "/api/enterprise/ha", scope: "Enterprise", description: "Read HA API deployment profile." },
  { id: "enterprise-dns", method: "GET", path: "/api/enterprise/dns", scope: "Enterprise", description: "Read HA DNS and multi-region DNS profile." },
  { id: "enterprise-dryrun", method: "POST", path: "/api/enterprise/bulk/dry-run", scope: "Enterprise", description: "Preview bulk operations before apply." },
  { id: "enterprise-siem", method: "GET", path: "/api/enterprise/siem", scope: "Enterprise", description: "Read SIEM export surface." }
];

const curlExample = `curl -H "X-OpenDeploy-Key: od_live_xxxxxxxxxxxxxxxxx" \\
  -H "Accept: application/json" \\
  http://localhost:4000/api/monitoring/overview`;

export default function ApiDocsPage() {
  return (
    <Shell>
      <PageHeader
        title="API Docs"
        description="Swagger-style reference for OpenDeploy automation, CI/CD integrations and external monitoring."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <KeyRound className="h-5 w-5 text-slate-400" />
          <div className="mt-3 font-semibold">Authentication</div>
          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Send automation tokens with the `X-OpenDeploy-Key` header. Tokens are hashed server-side and only shown once.</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ShieldCheck className="h-5 w-5 text-slate-400" />
          <div className="mt-3 font-semibold">Security model</div>
          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Use scoped keys, expiration dates and audit logs for CI/CD, backup, DNS and monitoring integrations.</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <TerminalSquare className="h-5 w-5 text-slate-400" />
          <div className="mt-3 font-semibold">Base URL</div>
          <code className="mt-2 block break-all rounded-lg bg-slate-100 p-2 text-xs dark:bg-slate-950">http://localhost:4000/api</code>
          <a className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-300" href="http://localhost:4000/api/docs/openapi.json" target="_blank" rel="noreferrer">OpenAPI JSON</a>
        </div>
      </div>

      <section className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <Copy className="h-4 w-4 text-slate-400" />
          <h2 className="font-semibold">Quick request</h2>
        </div>
        <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-sm text-slate-100 dark:border-slate-800"><code>{curlExample}</code></pre>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Endpoints</h2>
        <DataTable
          minWidth={720}
          columns={[
            { key: "method", label: "Method", render: (row) => <span className="badge badge-info">{row.method}</span> },
            { key: "path", label: "Path", render: (row) => <code className="break-all text-xs">{row.path}</code> },
            { key: "scope", label: "Scope" },
            { key: "description", label: "Description" }
          ]}
          rows={endpoints}
          empty="No endpoints documented."
        />
      </section>
    </Shell>
  );
}
