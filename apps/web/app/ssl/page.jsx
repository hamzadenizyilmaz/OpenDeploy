"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { apiFetch, humanDate } from "../../lib/api";
import { statusBadge, titleize } from "../../lib/format";

export default function SslPage() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ domain: "example.com", email: "admin@example.com", provider: "letsencrypt", force: false });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const data = await apiFetch("/ssl");
      setRows(data.certificates || []);
      setSummary(data.summary || null);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function issue(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const data = await apiFetch("/ssl/issue", { method: "POST", body: form });
      setMessage(`SSL issue queued. Job: ${data.jobId || "created"}`);
      setOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function action(type, row) {
    setError("");
    setMessage("");
    try {
      const data = await apiFetch(`/ssl/${type}`, { method: "POST", body: { certificateId: row.id } });
      setMessage(`${titleize(type)} queued. Job: ${data.jobId || "created"}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <PageHeader title="SSL Certificates" description="Issue, renew, revoke and monitor certificate lifecycle from DNS-ready domains." action={<ActionButton onClick={() => setOpen(true)}>Issue SSL</ActionButton>} />

      {message ? <div className="mb-4"><Notice type="success">{message}</Notice></div> : null}
      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {[
          ["Certificates", summary?.total || 0],
          ["Valid", summary?.valid || 0],
          ["Renewal due", summary?.renewal_due || 0],
          ["Expired", summary?.expired || 0]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
            <div className="mt-2 text-3xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <DataTable
        minWidth={980}
        columns={[
          { key: "domain", label: "Domain", render: (row) => row.domain?.hostname || row.domainId || "-" },
          { key: "issuer", label: "Issuer", render: (row) => titleize(row.issuer) },
          { key: "status", label: "Status", render: (row) => <span className={`badge badge-${statusBadge(row.status)}`}>{titleize(row.status)}</span> },
          { key: "lifecycle", label: "Lifecycle", render: (row) => <span className={`badge badge-${statusBadge(row.lifecycle)}`}>{titleize(row.lifecycle)}</span> },
          { key: "daysUntilExpiry", label: "Days", render: (row) => row.daysUntilExpiry ?? "-" },
          { key: "expiresAt", label: "Expires", render: (row) => humanDate(row.expiresAt) },
          { key: "certPath", label: "Certificate Path", render: (row) => <span className="block max-w-xs truncate" title={row.certPath}>{row.certPath || "-"}</span> },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <div className="flex gap-2">
                <ActionButton variant="secondary" onClick={() => action("renew", row)}>Renew</ActionButton>
                <ActionButton variant="danger" onClick={() => action("revoke", row)}>Revoke</ActionButton>
              </div>
            )
          }
        ]}
        rows={rows}
        empty="No certificates yet."
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Issue SSL Certificate" description="DNS should resolve before issuing Let's Encrypt certificates.">
        <form onSubmit={issue} className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="text-sm font-medium">Domain</span>
            <input className="input mt-1" value={form.domain} onChange={(event) => setForm({ ...form, domain: event.target.value })} />
          </label>
          <label>
            <span className="text-sm font-medium">Email</span>
            <input className="input mt-1" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            <span className="text-sm font-medium">Provider</span>
            <select className="input mt-1" value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })}>
              <option value="letsencrypt">Let's Encrypt</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pt-7">
            <input type="checkbox" checked={form.force} onChange={(event) => setForm({ ...form, force: event.target.checked })} />
            <span>Force reissue</span>
          </label>
          <div className="md:col-span-2"><ActionButton onClick={issue}>Queue SSL Issue</ActionButton></div>
        </form>
      </Modal>
    </Shell>
  );
}
