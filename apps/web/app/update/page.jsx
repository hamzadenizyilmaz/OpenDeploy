"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { apiFetch, humanDate } from "../../lib/api";
import { titleize, statusBadge } from "../../lib/format";

export default function UpdatePage() {
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function check() {
    try {
      setStatus(await apiFetch("/update/status"));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    check();
  }, []);

  async function run(force = false) {
    setError("");
    setMessage("");
    try {
      const data = await apiFetch("/update/run", { method: "POST", body: { force, backup: true } });
      setMessage(`Server update queued. Job: ${data.jobId || "created"}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function rollback() {
    setError("");
    setMessage("");
    try {
      const data = await apiFetch("/update/rollback", { method: "POST", body: { version: "previous" } });
      setMessage(`Rollback queued. Job: ${data.jobId || "created"}`);
    } catch (err) {
      setError(err.message);
    }
  }

  const core = status ? [{
    id: "opendeploy",
    component: "OpenDeploy",
    current: status.currentVersion,
    latest: status.latestVersion,
    repository: status.repository,
    publishedAt: status.release?.publishedAt,
    status: status.updateAvailable ? "warning" : "ok"
  }] : [];

  return (
    <Shell>
      <PageHeader
        title="Server Update"
        description="Check GitHub releases, queue guarded updates, restart managed services and keep rollback ready."
        action={(
          <>
            <ActionButton variant="secondary" onClick={check}>Check</ActionButton>
            <ActionButton onClick={() => run(false)}>Run Update</ActionButton>
            <ActionButton variant="warning" onClick={rollback}>Rollback</ActionButton>
          </>
        )}
      />

      {message ? <div className="mb-4"><Notice type="success">{message}</Notice></div> : null}
      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}
      {status?.releaseWarning ? <div className="mb-4"><Notice type="warning">GitHub release check warning: {status.releaseWarning}</Notice></div> : null}
      {status?.cronWatch ? <div className="mb-4"><Notice>{status.cronWatch}</Notice></div> : null}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-slate-500 dark:text-slate-400">Current</div>
          <div className="mt-2 text-2xl font-bold">{status?.currentVersion || "-"}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-slate-500 dark:text-slate-400">Latest GitHub Release</div>
          <div className="mt-2 text-2xl font-bold">{status?.latestVersion || "-"}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-slate-500 dark:text-slate-400">Checked</div>
          <div className="mt-2 text-lg font-semibold">{status?.checkedAt ? humanDate(status.checkedAt) : "-"}</div>
        </div>
      </div>

      <h2 className="mb-3 font-semibold">OpenDeploy Core</h2>
      <DataTable
        minWidth={820}
        columns={[
          { key: "component", label: "Component" },
          { key: "current", label: "Current" },
          { key: "latest", label: "Latest" },
          { key: "repository", label: "Repository" },
          { key: "publishedAt", label: "Published", render: (row) => humanDate(row.publishedAt) },
          { key: "status", label: "Status", render: (row) => <span className={`badge badge-${statusBadge(row.status)}`}>{titleize(row.status)}</span> }
        ]}
        rows={core}
        empty="Click Check."
      />

      <h2 className="mb-3 mt-6 font-semibold">Server Packages</h2>
      <DataTable
        minWidth={720}
        columns={[
          { key: "name", label: "Package", render: (row) => titleize(row.name) },
          { key: "current", label: "Current" },
          { key: "latest", label: "Latest" },
          { key: "status", label: "Status", render: (row) => <span className={`badge badge-${statusBadge(row.status)}`}>{titleize(row.status)}</span> }
        ]}
        rows={status?.serverPackages || []}
        empty="No package status yet."
      />

      <h2 className="mb-3 mt-6 font-semibold">Managed Services</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {(status?.services || []).map((service) => (
          <div key={service} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="font-medium">{service}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Restarted after successful update.</div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
