"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { apiFetch } from "../../lib/api";

export default function LogsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  async function load() { try { setData(await apiFetch("/logs")); setError(""); } catch (err) { setError(err.message); } }
  useEffect(() => { load(); }, []);
  return (
    <Shell>
      <PageHeader title="Logs" description="Build, runtime and system logs." action={<ActionButton variant="secondary" onClick={load}>Refresh</ActionButton>} />
      {error ? <Notice type="error">{error}</Notice> : <div className="card"><pre className="whitespace-pre-wrap text-sm">{JSON.stringify(data || { status: "loading" }, null, 2)}</pre></div>}
    </Shell>
  );
}
