"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Cpu, Database, HardDrive, MemoryStick } from "lucide-react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { apiFetch, humanDate } from "../../lib/api";
import { bytes, statusBadge, titleize } from "../../lib/format";

function PercentBar({ value, tone = "slate" }) {
  const n = Math.max(0, Math.min(100, Number(value || 0)));
  const color = tone === "danger" ? "bg-red-600" : tone === "warning" ? "bg-orange-500" : "bg-green-600";
  return (
    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${n}%` }} />
    </div>
  );
}

function resourceTone(value) {
  const n = Number(value || 0);
  if (n >= 85) return "danger";
  if (n >= 70) return "warning";
  return "ok";
}

function healthTone(value) {
  const n = Number(value || 0);
  if (n < 60) return "danger";
  if (n < 85) return "warning";
  return "ok";
}

function MetricPanel({ icon: Icon, label, value, hint, percent, tone, valueClassName = "" }) {
  const barTone = tone || resourceTone(percent);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
          <div className={`mt-2 break-words text-2xl font-bold text-slate-950 dark:text-white ${valueClassName}`}>{value}</div>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-slate-400" />
      </div>
      {percent !== undefined ? <div className="mt-4"><PercentBar value={percent} tone={barTone} /></div> : null}
      <div className="mt-2 break-words text-xs text-slate-500 dark:text-slate-400">{hint}</div>
    </div>
  );
}

export default function MonitoringPage() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setMetrics(await apiFetch("/monitoring/overview"));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const serviceRows = metrics?.services || [];
  const alertRows = metrics?.alerts || [];
  const health = metrics?.health || { score: 0, status: "unknown" };
  const resourceRows = useMemo(() => metrics ? [
    { id: "cpu", name: "CPU", usage: metrics.cpu?.usagePercent, detail: `${metrics.cpu?.cores || 0} core(s), load ${Number(metrics.cpu?.load1 || 0).toFixed(2)}` },
    { id: "memory", name: "Memory", usage: metrics.memory?.usagePercent, detail: `${bytes(metrics.memory?.usedBytes)} / ${bytes(metrics.memory?.totalBytes)}` },
    { id: "disk", name: "Disk", usage: metrics.disk?.usagePercent, detail: `${bytes(metrics.disk?.usedBytes)} / ${bytes(metrics.disk?.totalBytes)} on ${metrics.disk?.mount || "/"}` }
  ] : [], [metrics]);

  return (
    <Shell>
      <PageHeader
        title="Monitoring"
        description="Live host health, resource pressure, service status and production alerts."
        action={<ActionButton variant="secondary" onClick={load}>Refresh</ActionButton>}
      />

      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

      {metrics ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            <MetricPanel icon={Activity} label="Health Score" value={`${health.score}/100`} hint={titleize(health.status)} percent={health.score} tone={healthTone(health.score)} />
            <MetricPanel icon={Cpu} label="CPU Usage" value={`${metrics.cpu?.usagePercent || 0}%`} hint={metrics.cpu?.model || "Unknown CPU"} percent={metrics.cpu?.usagePercent} />
            <MetricPanel icon={MemoryStick} label="RAM Usage" value={`${metrics.memory?.usagePercent || 0}%`} hint={`${bytes(metrics.memory?.freeBytes)} free`} percent={metrics.memory?.usagePercent} />
            <MetricPanel icon={HardDrive} label="Disk Usage" value={`${metrics.disk?.usagePercent || 0}%`} hint={metrics.disk?.filesystem || metrics.disk?.note || "Disk adapter active"} percent={metrics.disk?.usagePercent} />
            <MetricPanel icon={Database} label="Host" value={metrics.host?.hostname || "-"} valueClassName="text-xl" hint={`${metrics.host?.platform || "-"} ${metrics.host?.release || ""}`} />
          </div>

          <div className="mb-6 grid gap-4 2xl:grid-cols-[0.9fr_1.1fr]">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-semibold">Resource Pressure</h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">Sampled {humanDate(metrics.sampledAt)}</span>
              </div>
              <DataTable
                compact
                minWidth={420}
                columns={[
                  { key: "name", label: "Resource" },
                  {
                    key: "usage",
                    label: "Usage",
                    render: (row) => (
                      <div className="min-w-32">
                        <div className="mb-1 text-xs text-slate-500">{row.usage || 0}%</div>
                        <PercentBar value={row.usage} tone={resourceTone(row.usage)} />
                      </div>
                    )
                  },
                  { key: "detail", label: "Detail" }
                ]}
                rows={resourceRows}
                empty="No resource metrics."
              />
            </section>

            <section>
              <h2 className="mb-3 font-semibold">Services</h2>
              {serviceRows.length ? (
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {serviceRows.map((service) => (
                    <div key={service.id || service.unit || service.name} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{service.name}</div>
                          <div className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{service.unit || "-"}</div>
                        </div>
                        <span className={`badge badge-${statusBadge(service.status)}`}>{titleize(service.status)}</span>
                      </div>
                      <div className="mt-3 break-words text-sm text-slate-600 dark:text-slate-300">
                        {service.details?.warning || service.details?.activeState || "No service detail."}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">No service metrics.</div>
              )}
            </section>
          </div>

          <section>
            <h2 className="mb-3 font-semibold">Alerts</h2>
            <DataTable
              compact
              minWidth={560}
              columns={[
                { key: "level", label: "Level", render: (row) => <span className={`badge badge-${statusBadge(row.level)}`}>{titleize(row.level)}</span> },
                { key: "title", label: "Title" },
                { key: "message", label: "Message" }
              ]}
              rows={alertRows}
              empty="No active alerts."
            />
          </section>
        </>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">Loading metrics...</div>
      )}
    </Shell>
  );
}
