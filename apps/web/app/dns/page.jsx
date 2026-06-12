"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, RotateCw, Trash2 } from "lucide-react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { apiFetch, humanDate } from "../../lib/api";
import { statusBadge, titleize } from "../../lib/format";

const recordTypes = ["A", "AAAA", "CNAME", "TXT", "MX", "SRV", "CAA", "NS"];

const initialRecord = {
  zoneId: "",
  name: "@",
  type: "A",
  value: "SERVER_PUBLIC_IP",
  ttl: 300,
  priority: "",
  proxied: false
};

function copyText(value) {
  if (navigator?.clipboard) navigator.clipboard.writeText(value).catch(() => {});
}

function fqdn(zone, name) {
  if (!zone) return name || "-";
  if (name === "@") return zone;
  return `${name}.${zone}`;
}

export default function DnsPage() {
  const [zones, setZones] = useState([]);
  const [nameservers, setNameservers] = useState([]);
  const [providers, setProviders] = useState(["opendeploy", "manual"]);
  const [cloud, setCloud] = useState({ enabled: false });
  const [zoneOpen, setZoneOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [subdomainOpen, setSubdomainOpen] = useState(false);
  const [zoneForm, setZoneForm] = useState({ domain: "example.com", provider: "opendeploy" });
  const [record, setRecord] = useState(initialRecord);
  const [subdomain, setSubdomain] = useState({ zoneId: "", label: "app", targetType: "A", target: "SERVER_PUBLIC_IP", ttl: 300, proxied: false });
  const [selectedZoneId, setSelectedZoneId] = useState("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const data = await apiFetch("/dns");
      const nextZones = data.zones || [];
      const nextProviders = data.providers || ["opendeploy", "manual"];
      setZones(nextZones);
      setNameservers(data.nameservers || []);
      setProviders(nextProviders);
      setCloud(data.cloud || { enabled: false });
      setZoneForm((value) => ({ ...value, provider: nextProviders.includes(value.provider) ? value.provider : nextProviders[0] }));
      const firstZone = nextZones[0]?.id || "";
      setRecord((value) => ({ ...value, zoneId: value.zoneId || firstZone }));
      setSubdomain((value) => ({ ...value, zoneId: value.zoneId || firstZone }));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const records = useMemo(
    () => zones.flatMap((zone) => (zone.records || []).map((item) => ({ ...item, zone: zone.domain, zoneId: zone.id, fqdn: fqdn(zone.domain, item.name) }))),
    [zones]
  );

  const filteredRecords = selectedZoneId === "all" ? records : records.filter((item) => item.zoneId === selectedZoneId);
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) || zones[0];

  async function createZone(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const data = await apiFetch("/dns/zones", { method: "POST", body: zoneForm });
      setMessage(`${data.zone?.domain || zoneForm.domain} DNS zone created and bootstrapped.`);
      setZoneOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createRecord(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const body = {
        ...record,
        ttl: Number(record.ttl),
        priority: record.priority === "" ? null : Number(record.priority)
      };
      const data = await apiFetch("/dns/records", { method: "POST", body });
      setMessage(`DNS record created: ${data.fqdn || record.name}`);
      setRecordOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createSubdomain(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const data = await apiFetch("/dns/subdomains", {
        method: "POST",
        body: { ...subdomain, ttl: Number(subdomain.ttl) }
      });
      setMessage(`Subdomain ready: ${data.fqdn}`);
      setSubdomainOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function bootstrap(zone) {
    setError("");
    setMessage("");
    try {
      await apiFetch(`/dns/zones/${zone.id}/bootstrap`, { method: "POST", body: {} });
      setMessage(`${zone.domain} default DNS records refreshed.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function verifyNs(zone) {
    setError("");
    setMessage("");
    try {
      const data = await apiFetch(`/dns/zones/${zone.id}/verify-ns`, { method: "POST", body: {} });
      setMessage(`${zone.domain} nameserver status: ${data.domain?.nsStatus || data.verification?.nsStatus || "checked"}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteRecord(row) {
    if (!window.confirm(`Delete ${row.type} ${row.fqdn}?`)) return;
    setError("");
    setMessage("");
    try {
      await apiFetch(`/dns/records/${row.id}`, { method: "DELETE" });
      setMessage("DNS record deleted.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <PageHeader
        title="DNS Manager"
        description="Manage OpenDeploy DNS zones, nameservers, records and subdomains from one control surface."
        action={(
          <>
            <ActionButton variant="secondary" onClick={() => setSubdomainOpen(true)}>New Subdomain</ActionButton>
            <ActionButton variant="secondary" onClick={() => setRecordOpen(true)}>New Record</ActionButton>
            <ActionButton onClick={() => setZoneOpen(true)}>New Zone</ActionButton>
          </>
        )}
      />

      {message ? <div className="mb-4"><Notice type="success">{message}</Notice></div> : null}
      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-slate-500 dark:text-slate-400">Zones</div>
          <div className="mt-2 text-3xl font-bold">{zones.length}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-slate-500 dark:text-slate-400">Records</div>
          <div className="mt-2 text-3xl font-bold">{records.length}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-slate-500 dark:text-slate-400">OpenDeploy Nameservers</div>
          <div className="mt-2 space-y-2">
            {nameservers.map((server) => (
              <button key={server} className="flex w-full items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-left text-sm dark:bg-slate-950" onClick={() => copyText(server)} type="button">
                <span className="truncate font-medium">{server}</span>
                <Copy className="h-4 w-4 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500 dark:text-slate-400">DNS Control Plane</div>
            <div className="mt-1 font-semibold">{cloud.brandName || "OpenDeploy DNS"}</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {cloud.enabled ? `${cloud.mode || "cloud"} mode via ${cloud.adminUrl || "DNS Cloud"}` : "Local DNS mode"}
            </div>
          </div>
          <span className={`badge badge-${cloud.enabled ? "running" : "unknown"}`}>{cloud.enabled ? "Cloud Connected" : "Local Fallback"}</span>
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Zones</h2>
          <select className="input max-w-64 rounded-lg" value={selectedZoneId} onChange={(event) => setSelectedZoneId(event.target.value)}>
            <option value="all">All zones</option>
            {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.domain}</option>)}
          </select>
        </div>
        <DataTable
          minWidth={820}
          columns={[
            { key: "domain", label: "Domain" },
            { key: "provider", label: "Provider", render: (row) => titleize(row.provider) },
            { key: "status", label: "Status", render: (row) => <span className={`badge badge-${statusBadge(row.status)}`}>{titleize(row.status)}</span> },
            { key: "nsStatus", label: "NS", render: (row) => row.nsStatus ? <span className={`badge badge-${statusBadge(row.nsStatus)}`}>{titleize(row.nsStatus)}</span> : "-" },
            { key: "nameservers", label: "Nameservers", render: (row) => (row.nameservers || []).join(", ") || "-" },
            { key: "createdAt", label: "Created", render: (row) => humanDate(row.createdAt) },
            { key: "actions", label: "Actions", render: (row) => (
              <div className="flex flex-wrap gap-2">
                {cloud.enabled ? <ActionButton variant="secondary" onClick={() => verifyNs(row)}><CheckCircle2 className="mr-2 inline h-4 w-4" />Verify NS</ActionButton> : null}
                <ActionButton variant="secondary" onClick={() => bootstrap(row)}><RotateCw className="mr-2 inline h-4 w-4" />Sync</ActionButton>
              </div>
            ) }
          ]}
          rows={zones}
          empty="No DNS zones yet."
        />
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Records</h2>
        <DataTable
          minWidth={900}
          columns={[
            { key: "zone", label: "Zone" },
            { key: "fqdn", label: "Name" },
            { key: "type", label: "Type" },
            { key: "value", label: "Value", render: (row) => <span className="block max-w-sm truncate" title={row.value}>{row.value}</span> },
            { key: "ttl", label: "TTL" },
            { key: "proxied", label: "Proxy", render: (row) => row.proxied ? "Enabled" : "Off" },
            { key: "enabled", label: "Status", render: (row) => <span className={`badge badge-${row.enabled ? "running" : "stopped"}`}>{row.enabled ? "Enabled" : "Disabled"}</span> },
            { key: "actions", label: "Actions", render: (row) => <ActionButton variant="danger" onClick={() => deleteRecord(row)}><Trash2 className="mr-2 inline h-4 w-4" />Delete</ActionButton> }
          ]}
          rows={filteredRecords}
          empty="No DNS records yet."
        />
      </div>

      <Modal open={zoneOpen} onClose={() => setZoneOpen(false)} title="New DNS Zone" description="Creates nameserver and default records for a domain managed by OpenDeploy.">
        <form onSubmit={createZone} className="grid gap-4">
          <label>
            <span className="text-sm font-medium">Domain</span>
            <input className="input mt-1" value={zoneForm.domain} onChange={(event) => setZoneForm({ ...zoneForm, domain: event.target.value })} />
          </label>
          <label>
            <span className="text-sm font-medium">Provider</span>
            <select className="input mt-1" value={zoneForm.provider} onChange={(event) => setZoneForm({ ...zoneForm, provider: event.target.value })}>
              {providers.map((provider) => <option key={provider} value={provider}>{titleize(provider)}</option>)}
            </select>
          </label>
          <ActionButton onClick={createZone}>Create Zone</ActionButton>
        </form>
      </Modal>

      <Modal open={recordOpen} onClose={() => setRecordOpen(false)} title="New DNS Record" description="Records are validated by type before they are stored.">
        <form onSubmit={createRecord} className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="text-sm font-medium">Zone</span>
            <select className="input mt-1" value={record.zoneId} onChange={(event) => setRecord({ ...record, zoneId: event.target.value })}>
              {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.domain}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium">Type</span>
            <select className="input mt-1" value={record.type} onChange={(event) => setRecord({ ...record, type: event.target.value })}>
              {recordTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium">Name</span>
            <input className="input mt-1" value={record.name} onChange={(event) => setRecord({ ...record, name: event.target.value })} />
          </label>
          <label>
            <span className="text-sm font-medium">Value</span>
            <input className="input mt-1" value={record.value} onChange={(event) => setRecord({ ...record, value: event.target.value })} />
          </label>
          <label>
            <span className="text-sm font-medium">TTL</span>
            <input className="input mt-1" type="number" min="60" max="86400" value={record.ttl} onChange={(event) => setRecord({ ...record, ttl: event.target.value })} />
          </label>
          <label>
            <span className="text-sm font-medium">Priority</span>
            <input className="input mt-1" type="number" value={record.priority} onChange={(event) => setRecord({ ...record, priority: event.target.value })} placeholder="MX/SRV only" />
          </label>
          <label className="flex items-center gap-2 md:col-span-2">
            <input type="checkbox" checked={record.proxied} onChange={(event) => setRecord({ ...record, proxied: event.target.checked })} />
            <span>Proxy/CDN enabled</span>
          </label>
          <div className="md:col-span-2"><ActionButton disabled={!record.zoneId} onClick={createRecord}>Create Record</ActionButton></div>
        </form>
      </Modal>

      <Modal open={subdomainOpen} onClose={() => setSubdomainOpen(false)} title="New Subdomain" description="Create an app, API or monitoring subdomain from a connected DNS zone.">
        <form onSubmit={createSubdomain} className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="text-sm font-medium">Zone</span>
            <select className="input mt-1" value={subdomain.zoneId} onChange={(event) => setSubdomain({ ...subdomain, zoneId: event.target.value })}>
              {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.domain}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium">Subdomain</span>
            <input className="input mt-1" value={subdomain.label} onChange={(event) => setSubdomain({ ...subdomain, label: event.target.value })} />
          </label>
          <label>
            <span className="text-sm font-medium">Target type</span>
            <select className="input mt-1" value={subdomain.targetType} onChange={(event) => setSubdomain({ ...subdomain, targetType: event.target.value })}>
              {["A", "AAAA", "CNAME"].map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium">Target</span>
            <input className="input mt-1" value={subdomain.target} onChange={(event) => setSubdomain({ ...subdomain, target: event.target.value })} />
          </label>
          <label>
            <span className="text-sm font-medium">TTL</span>
            <input className="input mt-1" type="number" min="60" max="86400" value={subdomain.ttl} onChange={(event) => setSubdomain({ ...subdomain, ttl: event.target.value })} />
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="text-slate-500 dark:text-slate-400">Preview</div>
            <div className="mt-1 font-medium">{subdomain.label}.{selectedZone?.domain || zones.find((zone) => zone.id === subdomain.zoneId)?.domain || "example.com"}</div>
          </div>
          <label className="flex items-center gap-2 md:col-span-2">
            <input type="checkbox" checked={subdomain.proxied} onChange={(event) => setSubdomain({ ...subdomain, proxied: event.target.checked })} />
            <span>Proxy/CDN enabled</span>
          </label>
          <div className="md:col-span-2"><ActionButton disabled={!subdomain.zoneId} onClick={createSubdomain}>Create Subdomain</ActionButton></div>
        </form>
      </Modal>
    </Shell>
  );
}
