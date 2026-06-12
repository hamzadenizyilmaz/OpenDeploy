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

const SENSITIVE_PORTS = new Set([22, 3306, 5432, 6379, 27017, 9200, 9300, 11211]);

const initialForm = {
  port: 3000,
  protocol: "tcp",
  sourceIp: "",
  description: "Application upstream port"
};

function sourceLabel(value) {
  return value ? value : "Any source";
}

function riskFor(rule) {
  const publicRule = !rule.sourceIp;
  const sensitive = SENSITIVE_PORTS.has(Number(rule.port));
  if (publicRule && sensitive) return "critical";
  if (publicRule) return "warning";
  return "restricted";
}

function validateForm(form) {
  const port = Number(form.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return "Port must be between 1 and 65535.";
  if (!["tcp", "udp"].includes(form.protocol)) return "Protocol must be TCP or UDP.";
  if (SENSITIVE_PORTS.has(port) && !form.sourceIp.trim()) {
    return "Sensitive ports require a source IP or CIDR allowlist.";
  }
  return "";
}

export default function PortsPage() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [query, setQuery] = useState("");
  const [protocol, setProtocol] = useState("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const data = await apiFetch("/firewall");
      setRows(data.rules || []);
      setSummary(data.summary || null);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesProtocol = protocol === "all" || row.protocol === protocol;
      const haystack = `${row.port} ${row.protocol} ${row.sourceIp || ""} ${row.description || ""}`.toLowerCase();
      return matchesProtocol && (!text || haystack.includes(text));
    });
  }, [protocol, query, rows]);

  const localSummary = useMemo(() => {
    const active = rows.filter((row) => row.enabled !== false);
    return {
      active: active.length,
      tcp: active.filter((row) => row.protocol === "tcp").length,
      udp: active.filter((row) => row.protocol === "udp").length,
      restricted: active.filter((row) => !!row.sourceIp).length
    };
  }, [rows]);

  const viewSummary = summary || localSummary;

  async function openPort(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const validationMessage = validateForm(form);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    try {
      await apiFetch("/firewall/open", {
        method: "POST",
        body: {
          port: Number(form.port),
          protocol: form.protocol,
          sourceIp: form.sourceIp.trim() || undefined,
          description: form.description.trim() || undefined
        }
      });
      setMessage("Port rule applied.");
      setOpen(false);
      setForm(initialForm);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function closePort(row) {
    if (!window.confirm(`Close ${row.port}/${String(row.protocol || "tcp").toUpperCase()}?`)) return;
    setError("");
    setMessage("");
    try {
      await apiFetch("/firewall/close", {
        method: "POST",
        body: {
          port: Number(row.port),
          protocol: row.protocol || "tcp",
          sourceIp: row.sourceIp || undefined
        }
      });
      setMessage("Port rule closed.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Ports"
        description="Open, restrict and close explicit TCP/UDP rules without mixing them into firewall policy presets."
        action={<ActionButton onClick={() => setOpen(true)}>New Port Rule</ActionButton>}
      />

      {message ? <div className="mb-4"><Notice type="success">{message}</Notice></div> : null}
      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Active", viewSummary.active || 0],
          ["TCP", viewSummary.tcp || 0],
          ["UDP", viewSummary.udp || 0],
          ["Allowlisted", viewSummary.restricted || 0]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
            <div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_180px_auto]">
        <input
          className="input rounded-lg"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search port, source or description"
        />
        <select className="input rounded-lg" value={protocol} onChange={(event) => setProtocol(event.target.value)}>
          <option value="all">All protocols</option>
          <option value="tcp">TCP</option>
          <option value="udp">UDP</option>
        </select>
        <Link className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" href="/firewall">
          Firewall
        </Link>
      </div>

      <DataTable
        minWidth={860}
        columns={[
          { key: "port", label: "Port" },
          { key: "protocol", label: "Protocol", render: (row) => String(row.protocol || "tcp").toUpperCase() },
          { key: "sourceIp", label: "Source", render: (row) => sourceLabel(row.sourceIp) },
          {
            key: "risk",
            label: "Risk",
            render: (row) => {
              const risk = riskFor(row);
              return <span className={`badge badge-${statusBadge(risk)}`}>{titleize(risk)}</span>;
            }
          },
          { key: "description", label: "Description" },
          {
            key: "enabled",
            label: "Status",
            render: (row) => <span className={`badge badge-${statusBadge(row.enabled ? "enabled" : "disabled")}`}>{row.enabled ? "Enabled" : "Disabled"}</span>
          },
          { key: "createdAt", label: "Created", render: (row) => humanDate(row.createdAt) },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <ActionButton disabled={row.enabled === false} variant="danger" onClick={() => closePort(row)}>
                Close
              </ActionButton>
            )
          }
        ]}
        rows={filteredRows}
        empty="No port rules found."
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Port Rule"
        description="Database, cache and SSH ports require an explicit IP or CIDR allowlist."
      >
        <form onSubmit={openPort} className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="text-sm font-medium">Port</span>
            <input
              type="number"
              min="1"
              max="65535"
              className="input mt-1"
              value={form.port}
              onChange={(event) => setForm({ ...form, port: event.target.value })}
              required
            />
          </label>
          <label>
            <span className="text-sm font-medium">Protocol</span>
            <select className="input mt-1" value={form.protocol} onChange={(event) => setForm({ ...form, protocol: event.target.value })}>
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
            </select>
          </label>
          <label>
            <span className="text-sm font-medium">Source IP or CIDR</span>
            <input
              className="input mt-1"
              value={form.sourceIp}
              onChange={(event) => setForm({ ...form, sourceIp: event.target.value })}
              placeholder="203.0.113.10 or 203.0.113.0/24"
              maxLength={64}
            />
          </label>
          <label>
            <span className="text-sm font-medium">Description</span>
            <input
              className="input mt-1"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              maxLength={160}
            />
          </label>
          <div className="md:col-span-2">
            <ActionButton onClick={openPort}>Apply Port Rule</ActionButton>
          </div>
        </form>
      </Modal>
    </Shell>
  );
}
