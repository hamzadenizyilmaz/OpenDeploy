"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { apiFetch, humanDate } from "../../lib/api";
import { statusBadge, titleize } from "../../lib/format";

const initialForm = {
  hostname: "example.com",
  projectId: "",
  proxyType: "nginx",
  autoSsl: true,
  dnsCheck: true,
  createDnsCloudZone: true
};

export default function DomainsPage() {
  const [rows, setRows] = useState([]);
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [lastDns, setLastDns] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [domains, projectsData] = await Promise.all([apiFetch("/domains"), apiFetch("/projects")]);
      setRows(domains.items || []);
      setProjects(projectsData.items || projectsData.projects || []);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    return {
      total: rows.length,
      resolved: rows.filter((row) => row.dnsStatus === "resolved").length,
      ssl: rows.filter((row) => row.sslEnabled).length,
      zones: rows.filter((row) => row.dnsCloudZone).length
    };
  }, [rows]);

  async function create(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLastDns(null);
    try {
      const data = await apiFetch("/domains", {
        method: "POST",
        body: { ...form, projectId: form.projectId || null }
      });
      setMessage(`Domain saved. DNS: ${data.dns?.status || "unknown"}`);
      setLastDns(data.dns || null);
      setOpen(false);
      setForm(initialForm);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function check(row) {
    setError("");
    setMessage("");
    try {
      const data = await apiFetch(`/domains/${row.id}/check-dns`, { method: "POST", body: {} });
      setMessage(`DNS checked for ${row.hostname}: ${data.dns?.status}`);
      setLastDns(data.dns || null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Domains"
        description="Attach domains to projects, create OpenDeploy DNS zones, validate records, and prepare SSL/proxy workflows."
        action={<ActionButton onClick={() => setOpen(true)}>New Domain</ActionButton>}
      />

      {message ? <div className="mb-4"><Notice type="success">{message}</Notice></div> : null}
      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Domains", summary.total],
          ["Resolved", summary.resolved],
          ["Auto SSL", summary.ssl],
          ["DNS Zones", summary.zones]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
            <div className="mt-2 text-3xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      {lastDns ? (
        <div className="mb-4">
          <Notice type={lastDns.status === "resolved" ? "success" : "warning"}>
            DNS check: A {lastDns.records?.A?.length || 0}, AAAA {lastDns.records?.AAAA?.length || 0}, CNAME {lastDns.records?.CNAME?.length || 0}, NS {lastDns.records?.NS?.length || 0}.
          </Notice>
        </div>
      ) : null}

      <DataTable
        minWidth={980}
        columns={[
          { key: "hostname", label: "Hostname", render: (row) => <span className="font-medium">{row.hostname}</span> },
          { key: "project", label: "Project", render: (row) => row.project?.name || "Unassigned" },
          { key: "rootDomain", label: "Root" },
          { key: "dnsStatus", label: "DNS", render: (row) => <span className={`badge badge-${statusBadge(row.dnsStatus)}`}>{titleize(row.dnsStatus)}</span> },
          { key: "dnsCloudZone", label: "DNS Cloud", render: (row) => row.dnsCloudZone ? <Link className="underline" href="/dns">{row.dnsCloudZone.provider}</Link> : "External" },
          { key: "sslEnabled", label: "SSL", render: (row) => row.sslEnabled ? "Auto" : "Off" },
          { key: "proxyType", label: "Proxy", render: (row) => titleize(row.proxyType) },
          { key: "createdAt", label: "Created", render: (row) => humanDate(row.createdAt) },
          { key: "actions", label: "Actions", render: (row) => <ActionButton variant="secondary" onClick={() => check(row)}>Check DNS</ActionButton> }
        ]}
        rows={rows}
        empty="No domains yet."
      />

      <Modal open={open} onClose={() => setOpen(false)} title="New Domain" description="You can create the DNS zone immediately, then add subdomains from DNS Manager.">
        <form onSubmit={create} className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="text-sm font-medium">Hostname</span>
            <input className="input mt-1" value={form.hostname} onChange={(event) => setForm({ ...form, hostname: event.target.value })} />
          </label>
          <label>
            <span className="text-sm font-medium">Project</span>
            <select className="input mt-1" value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })}>
              <option value="">Unassigned</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium">Proxy</span>
            <select className="input mt-1" value={form.proxyType} onChange={(event) => setForm({ ...form, proxyType: event.target.value })}>
              <option value="nginx">Nginx</option>
              <option value="apache">Apache</option>
            </select>
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="font-medium">DNS workflow</div>
            <div className="mt-1 text-slate-500 dark:text-slate-400">Create an OpenDeploy zone, then point registrar nameservers to DNS Manager values.</div>
          </div>
          {[
            ["autoSsl", "Enable Auto SSL"],
            ["dnsCheck", "Run DNS check now"],
            ["createDnsCloudZone", "Create DNS Cloud zone"]
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} />
              <span>{label}</span>
            </label>
          ))}
          <div className="md:col-span-2"><ActionButton onClick={create}>Save Domain</ActionButton></div>
        </form>
      </Modal>
    </Shell>
  );
}
