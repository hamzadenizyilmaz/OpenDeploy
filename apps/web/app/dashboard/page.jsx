"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { DataTable } from "../../components/DataTable";
import { Notice } from "../../components/Notice";
import { apiFetch } from "../../lib/api";

const fallbackDeployments = [
  { id: 1, project: "opendeploy-api", branch: "main", status: "running", time: "local" },
  { id: 2, project: "frontend", branch: "main", status: "created", time: "local" }
];

export default function DashboardPage() {
  const [overview, setOverview] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.allSettled([
      apiFetch("/monitoring/overview"),
      apiFetch("/projects")
    ]).then(([metrics, projectResult]) => {
      if (metrics.status === "fulfilled") setOverview(metrics.value);
      if (projectResult.status === "fulfilled") setProjects(projectResult.value.projects || []);
      const failed = [metrics, projectResult].find((item) => item.status === "rejected");
      if (failed) setError(failed.reason.message);
    });
  }, []);

  const running = projects.filter((p) => p.status === "running").length;
  const failed = projects.filter((p) => p.status === "failed").length;

  return (
    <Shell>
      <PageHeader title="Dashboard" description="Server health, projects, deployments and warnings." />
      {error ? <div className="mb-4"><Notice type="warning">Some live metrics could not be loaded: {error}</Notice></div> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="CPU Usage" value={overview?.cpu?.usagePercent ? `${overview.cpu.usagePercent}%` : "--"} hint={overview?.loadAverage ? `Load average: ${overview.loadAverage}` : "Agent metrics"} />
        <StatCard label="RAM Usage" value={overview?.memory?.usedPercent ? `${overview.memory.usedPercent}%` : "--"} hint={overview?.memory?.total ? `${overview.memory.total} total` : "Waiting for agent"} />
        <StatCard label="Disk Usage" value={overview?.disk?.usedPercent ? `${overview.disk.usedPercent}%` : "--"} hint="/var/lib/opendeploy" />
        <StatCard label="Running Projects" value={String(running)} hint={`${failed} failed / ${projects.length} total`} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <h2 className="mb-4 font-semibold">Recent Deployments</h2>
          <DataTable
            columns={[
              { key: "project", label: "Project" },
              { key: "branch", label: "Branch" },
              { key: "status", label: "Status", render: (row) => <span className={`badge badge-${row.status}`}>{row.status}</span> },
              { key: "time", label: "Time" }
            ]}
            rows={projects.length ? projects.slice(0, 5).map((p) => ({ id: p.id, project: p.name, branch: p.branch, status: p.status, time: "latest" })) : fallbackDeployments}
          />
        </div>

        <div className="card">
          <h2 className="mb-4 font-semibold">Service Status</h2>
          <div className="space-y-3 text-sm">
            {["Nginx", "PostgreSQL", "Redis", "OpenDeploy API", "Worker"].map((service) => (
              <div key={service} className="flex items-center justify-between gap-3">
                <span>{service}</span>
                <span className="badge badge-unknown">check</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
