"use client";

import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { DataTable } from "../../components/DataTable";
import { apiFetch } from "../../lib/api";
import { titleize } from "../../lib/format";

const initialForm = {
  domain: "example.com",
  upstreamPort: 3000,
  server: "nginx",
  template: "nextjs",
  enableSsl: false,
  websocket: true,
  gzip: true,
  redirectWww: false,
  redirectHttps: true,
  uploadLimit: "50m",
  proxyTimeout: 60
};

export default function ProxyPage() {
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/proxy/templates")
      .then((data) => setTemplates(data.templates || []))
      .catch((err) => setError(err.message));
  }, []);

  const selectedTemplate = useMemo(() => templates.find((template) => template.id === form.template), [form.template, templates]);

  function applyTemplate(template) {
    setForm((current) => ({
      ...current,
      template: template.id,
      server: template.server,
      websocket: template.websocket,
      gzip: template.gzip,
      uploadLimit: template.uploadLimit,
      proxyTimeout: template.timeout
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiFetch("/proxy/site", {
        method: "POST",
        body: { ...form, upstreamPort: Number(form.upstreamPort), proxyTimeout: Number(form.proxyTimeout) }
      });
      setMessage(`${form.server.toUpperCase()} site config requested.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function reload(server) {
    setError("");
    setMessage("");
    try {
      await apiFetch(`/proxy/${server}/reload`, { method: "POST", body: {} });
      setMessage(`${server.toUpperCase()} reload requested.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function test(server) {
    setError("");
    setMessage("");
    try {
      await apiFetch("/proxy/test", { method: "POST", body: { server } });
      setMessage(`${server.toUpperCase()} config test requested.`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Nginx / Apache"
        description="Apply ready reverse proxy profiles, generate configs, test syntax and reload managed services."
        action={(
          <>
            <ActionButton variant="secondary" onClick={() => test("nginx")}>Test Nginx</ActionButton>
            <ActionButton variant="secondary" onClick={() => reload("nginx")}>Reload Nginx</ActionButton>
            <ActionButton variant="secondary" onClick={() => reload("apache")}>Reload Apache</ActionButton>
          </>
        )}
      />

      {message ? <div className="mb-4"><Notice type="success">{message}</Notice></div> : null}
      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

      <div className="mb-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section>
          <h2 className="mb-3 font-semibold">Ready Templates</h2>
          <DataTable
            compact
            minWidth={720}
            columns={[
              { key: "name", label: "Template" },
              { key: "category", label: "Category" },
              { key: "server", label: "Server", render: (row) => titleize(row.server) },
              { key: "websocket", label: "WebSocket", render: (row) => row.websocket ? "Yes" : "No" },
              { key: "gzip", label: "Gzip", render: (row) => row.gzip ? "Yes" : "No" },
              { key: "uploadLimit", label: "Upload" },
              { key: "timeout", label: "Timeout" },
              { key: "actions", label: "Actions", render: (row) => <ActionButton variant="secondary" onClick={() => applyTemplate(row)}>Use</ActionButton> }
            ]}
            rows={templates}
            empty="No templates."
          />
        </section>

        <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Site Config</h2>
            <span className="text-xs text-slate-500">{selectedTemplate?.name || "Custom"}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="text-sm font-medium">Domain</span>
              <input className="input mt-1" value={form.domain} onChange={(event) => setForm({ ...form, domain: event.target.value })} />
            </label>
            <label>
              <span className="text-sm font-medium">Server</span>
              <select className="input mt-1" value={form.server} onChange={(event) => setForm({ ...form, server: event.target.value })}>
                <option value="nginx">Nginx</option>
                <option value="apache">Apache</option>
              </select>
            </label>
            <label>
              <span className="text-sm font-medium">Template</span>
              <select className="input mt-1" value={form.template} onChange={(event) => setForm({ ...form, template: event.target.value })}>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
            </label>
            <label>
              <span className="text-sm font-medium">Upstream port</span>
              <input type="number" min="1" max="65535" className="input mt-1" value={form.upstreamPort} onChange={(event) => setForm({ ...form, upstreamPort: event.target.value })} />
            </label>
            <label>
              <span className="text-sm font-medium">Upload limit</span>
              <input className="input mt-1" value={form.uploadLimit} onChange={(event) => setForm({ ...form, uploadLimit: event.target.value })} />
            </label>
            <label>
              <span className="text-sm font-medium">Proxy timeout</span>
              <input type="number" min="5" max="600" className="input mt-1" value={form.proxyTimeout} onChange={(event) => setForm({ ...form, proxyTimeout: event.target.value })} />
            </label>
            {["enableSsl", "websocket", "gzip", "redirectWww", "redirectHttps"].map((key) => (
              <label key={key} className="flex items-center gap-2">
                <input type="checkbox" checked={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} />
                <span>{titleize(key)}</span>
              </label>
            ))}
            <div className="md:col-span-2"><ActionButton onClick={submit}>Create Site Config</ActionButton></div>
          </div>
        </form>
      </div>
    </Shell>
  );
}
