"use client";

import { Shell } from "../../../components/Shell";
import { PageHeader } from "../../../components/PageHeader";
import { apiFetch } from "../../../lib/api";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "../../../components/Notice";
import { ActionButton } from "../../../components/ActionButton";

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    framework: "Next.js",
    runtime: "node",
    repositoryUrl: "",
    branch: "main",
    packageManager: "auto",
    nodeVersion: "lts",
    installCommand: "npm install",
    buildCommand: "npm run build",
    startCommand: "npm run start",
    workingDirectory: ".",
    outputDirectory: "",
    port: 3000,
    domain: ""
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value, ...(key === "name" && !current.slug ? { slug: value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") } : {}) }));
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await apiFetch("/projects", { method: "POST", body: { ...form, port: Number(form.port) || undefined } });
      setMessage("Project created successfully.");
      setTimeout(() => router.replace("/projects"), 600);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const field = (key, label, type = "text") => (
    <label className="block" key={key}>
      <span className="text-sm font-medium">{label}</span>
      <input className="input mt-1" type={type} value={form[key] ?? ""} onChange={(e) => update(key, e.target.value)} />
    </label>
  );

  return (
    <Shell>
      <PageHeader title="Create Project" description="Connect a Git repo and define build/runtime settings." />
      <form onSubmit={submit} className="card grid gap-4 lg:grid-cols-2">
        {message ? <div className="lg:col-span-2"><Notice type="success">{message}</Notice></div> : null}
        {error ? <div className="lg:col-span-2"><Notice type="error">{error}</Notice></div> : null}
        {field("name", "Project name")}
        {field("slug", "Slug")}
        <label className="block"><span className="text-sm font-medium">Framework</span><select className="input mt-1" value={form.framework} onChange={(e) => update("framework", e.target.value)}>{["Next.js","React","Vite","Vue","Nuxt","Express","Fastify","NestJS","Astro","SvelteKit","Static site","Custom JavaScript app"].map((item)=><option key={item}>{item}</option>)}</select></label>
        {field("nodeVersion", "Node.js version")}
        {field("repositoryUrl", "Repository URL")}
        {field("branch", "Git branch")}
        {field("packageManager", "Package manager")}
        {field("port", "Port", "number")}
        {field("installCommand", "Install command")}
        {field("buildCommand", "Build command")}
        {field("startCommand", "Start command")}
        {field("workingDirectory", "Working directory")}
        {field("outputDirectory", "Output directory")}
        {field("domain", "Domain")}
        <div className="flex gap-2 lg:col-span-2">
          <ActionButton disabled={loading} onClick={submit}>{loading ? "Creating..." : "Create Project"}</ActionButton>
          <ActionButton variant="secondary" onClick={() => router.back()}>Cancel</ActionButton>
        </div>
      </form>
    </Shell>
  );
}
