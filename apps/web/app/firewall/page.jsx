"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { apiFetch } from "../../lib/api";
import { statusBadge, titleize } from "../../lib/format";

const SENSITIVE_PORTS = new Set([22, 3306, 5432, 6379, 27017, 9200, 9300, 11211]);

function portList(preset) {
  return (preset.ports || []).map((item) => `${item.port}/${String(item.protocol || "tcp").toUpperCase()}`).join(", ");
}

function sourceLabel(value) {
  return value ? value : "Public";
}

function ruleRisk(rule) {
  const publicRule = !rule.sourceIp;
  const sensitive = SENSITIVE_PORTS.has(Number(rule.port));

  if (publicRule && sensitive) return "critical";
  if (publicRule) return "warning";
  return "restricted";
}

export default function FirewallPage() {
  const [rules, setRules] = useState([]);
  const [presets, setPresets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [sourceIp, setSourceIp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const data = await apiFetch("/firewall");
      setRules(data.rules || []);
      setPresets(data.presets || []);
      setSummary(data.summary || null);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const localSummary = useMemo(() => {
    const active = rules.filter((rule) => rule.enabled !== false);
    return {
      active: active.length,
      public: active.filter((rule) => !rule.sourceIp).length,
      restricted: active.filter((rule) => !!rule.sourceIp).length,
      critical: active.filter((rule) => ruleRisk(rule) === "critical").length
    };
  }, [rules]);

  const viewSummary = summary || localSummary;
  const exposedRules = useMemo(
    () => rules.filter((rule) => rule.enabled !== false && ["critical", "warning"].includes(ruleRisk(rule))),
    [rules]
  );

  async function applyPreset(event) {
    event.preventDefault();
    if (!selectedPreset) return;

    setError("");
    setMessage("");
    try {
      await apiFetch("/firewall/apply-preset", {
        method: "POST",
        body: {
          presetId: selectedPreset.id,
          sourceIp: sourceIp.trim() || undefined
        }
      });
      setMessage(`${selectedPreset.name} preset applied.`);
      setSelectedPreset(null);
      setSourceIp("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Firewall"
        description="Review firewall posture, apply safe presets, and keep public exposure separate from custom port rules."
        action={<ActionButton variant="secondary" onClick={load}>Refresh</ActionButton>}
      />

      {message ? <div className="mb-4"><Notice type="success">{message}</Notice></div> : null}
      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Active rules", viewSummary.active || 0, "Enabled firewall entries"],
          ["Public rules", viewSummary.public || 0, "Open to any source"],
          ["Restricted rules", viewSummary.restricted || 0, "IP or CIDR allowlisted"],
          ["Critical exposure", viewSummary.critical || 0, "Sensitive public ports"]
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
            <div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Policy Presets</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">{presets.length} preset(s)</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {presets.map((preset) => {
              const restricted = preset.requiresAllowlist;
              return (
                <div key={preset.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{preset.name}</div>
                      <div className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {preset.category || "Preset"}
                      </div>
                    </div>
                    {restricted ? <ShieldAlert className="h-5 w-5 text-orange-500" /> : <ShieldCheck className="h-5 w-5 text-green-600" />}
                  </div>
                  <div className="mt-3 text-sm text-slate-700 dark:text-slate-200">{portList(preset)}</div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{preset.warning}</div>
                  <div className="mt-4">
                    <ActionButton
                      variant={restricted ? "warning" : "secondary"}
                      onClick={() => {
                        setSelectedPreset(preset);
                        setSourceIp("");
                      }}
                    >
                      Apply Preset
                    </ActionButton>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-semibold">Exposure Review</h2>
          <DataTable
            compact
            minWidth={560}
            columns={[
              { key: "port", label: "Port", render: (rule) => `${rule.port}/${String(rule.protocol || "tcp").toUpperCase()}` },
              { key: "sourceIp", label: "Scope", render: (rule) => sourceLabel(rule.sourceIp) },
              {
                key: "risk",
                label: "Risk",
                render: (rule) => {
                  const risk = ruleRisk(rule);
                  return <span className={`badge badge-${statusBadge(risk)}`}>{titleize(risk)}</span>;
                }
              },
              { key: "description", label: "Description" }
            ]}
            rows={exposedRules}
            empty="No public exposure detected."
          />
        </section>
      </div>

      <Modal
        open={!!selectedPreset}
        onClose={() => setSelectedPreset(null)}
        title={`Apply ${selectedPreset?.name || "Preset"}`}
        description="Sensitive presets require an IP or CIDR allowlist before they can be applied."
      >
        <form onSubmit={applyPreset} className="grid gap-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="font-medium">{selectedPreset ? portList(selectedPreset) : "-"}</div>
            <div className="mt-1 text-slate-500 dark:text-slate-400">{selectedPreset?.warning}</div>
          </div>
          <label>
            <span className="text-sm font-medium">Source IP or CIDR</span>
            <input
              className="input mt-1"
              value={sourceIp}
              onChange={(event) => setSourceIp(event.target.value)}
              placeholder={selectedPreset?.requiresAllowlist ? "203.0.113.10 or 203.0.113.0/24" : "Optional"}
              maxLength={64}
            />
          </label>
          <ActionButton onClick={applyPreset}>Apply Preset</ActionButton>
        </form>
      </Modal>
    </Shell>
  );
}
