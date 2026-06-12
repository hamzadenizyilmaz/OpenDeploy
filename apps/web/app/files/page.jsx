"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Edit3, File, Folder, Trash2 } from "lucide-react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { apiFetch, humanDate } from "../../lib/api";
import { bytes, titleize } from "../../lib/format";

export default function FilesPage() {
  const [rows, setRows] = useState([]);
  const [currentPath, setCurrentPath] = useState(".");
  const [open, setOpen] = useState(false);
  const [editor, setEditor] = useState({ open: false, path: "", content: "" });
  const [rename, setRename] = useState({ open: false, from: "", to: "" });
  const [form, setForm] = useState({ path: "README.md", type: "file", content: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(path = currentPath) {
    try {
      const data = await apiFetch(`/files?path=${encodeURIComponent(path)}`);
      setRows(data.entries || []);
      setCurrentPath(data.path || path);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load(".");
  }, []);

  function parentPath() {
    return currentPath.split(/[\\/]/).filter(Boolean).slice(0, -1).join("/") || ".";
  }

  async function create(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiFetch("/files/create", { method: "POST", body: form });
      setMessage("File entry created.");
      setOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function read(row) {
    if (row.type === "directory") return load(row.path);
    if (!row.editable) {
      setError("This file is protected, binary, or too large for browser editing.");
      return null;
    }
    try {
      const data = await apiFetch("/files/read", { method: "POST", body: { path: row.path } });
      setEditor({ open: true, path: data.path, content: data.content });
      setError("");
    } catch (err) {
      setError(err.message);
    }
    return null;
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiFetch("/files/write", { method: "POST", body: { path: editor.path, content: editor.content } });
      setMessage("File saved.");
      setEditor({ ...editor, open: false });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function renamePath(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiFetch("/files/rename", { method: "POST", body: { from: rename.from, to: rename.to } });
      setMessage("File entry renamed.");
      setRename({ open: false, from: "", to: "" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function del(row) {
    if (!window.confirm(`Delete ${row.path}?`)) return;
    setError("");
    setMessage("");
    try {
      await apiFetch("/files/delete", { method: "POST", body: { from: row.path, confirm: "delete" } });
      setMessage("File entry deleted.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <PageHeader title="File Manager" description="Project-root file operations with protected path guard, audit logging and browser-safe editor limits." action={<ActionButton onClick={() => setOpen(true)}>New File / Folder</ActionButton>} />

      {message ? <div className="mb-4"><Notice type="success">{message}</Notice></div> : null}
      {error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Current path</div>
          <code className="break-all text-sm">{currentPath}</code>
        </div>
        <ActionButton variant="secondary" onClick={() => load(parentPath())}><ArrowUp className="mr-2 inline h-4 w-4" />Up</ActionButton>
      </div>

      <DataTable
        minWidth={900}
        columns={[
          {
            key: "name",
            label: "Name",
            render: (row) => (
              <button className="inline-flex items-center gap-2 font-medium hover:underline" onClick={() => read(row)} type="button">
                {row.type === "directory" ? <Folder className="h-4 w-4" /> : <File className="h-4 w-4" />}
                <span>{row.name}</span>
              </button>
            )
          },
          { key: "type", label: "Type", render: (row) => titleize(row.type) },
          { key: "size", label: "Size", render: (row) => bytes(row.size) },
          { key: "permissions", label: "Perm" },
          { key: "editable", label: "Editable", render: (row) => row.type === "directory" ? "-" : row.editable ? "Yes" : row.protected ? "Protected" : "No" },
          { key: "updatedAt", label: "Updated", render: (row) => humanDate(row.updatedAt) },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <ActionButton variant="secondary" disabled={row.type !== "directory" && !row.editable} onClick={() => read(row)}>
                  {row.type === "directory" ? "Open" : "Edit"}
                </ActionButton>
                <ActionButton variant="secondary" onClick={() => setRename({ open: true, from: row.path, to: row.path })}><Edit3 className="h-4 w-4" /></ActionButton>
                <ActionButton variant="danger" onClick={() => del(row)}><Trash2 className="h-4 w-4" /></ActionButton>
              </div>
            )
          }
        ]}
        rows={rows}
        empty="No files in this directory."
      />

      <Modal open={open} onClose={() => setOpen(false)} title="New File / Directory" description="Protected system, secret and key paths are blocked.">
        <form onSubmit={create} className="grid gap-4">
          <label>
            <span className="text-sm font-medium">Path</span>
            <input className="input mt-1" value={form.path} onChange={(event) => setForm({ ...form, path: event.target.value })} />
          </label>
          <label>
            <span className="text-sm font-medium">Type</span>
            <select className="input mt-1" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              <option value="file">File</option>
              <option value="directory">Directory</option>
            </select>
          </label>
          <label>
            <span className="text-sm font-medium">Content</span>
            <textarea className="input mt-1 min-h-32 font-mono" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
          </label>
          <ActionButton onClick={create}>Create</ActionButton>
        </form>
      </Modal>

      <Modal open={editor.open} onClose={() => setEditor({ ...editor, open: false })} title={`Edit ${editor.path}`} description="Changes are written with audit logging.">
        <form onSubmit={save} className="grid gap-4">
          <textarea className="input min-h-96 font-mono text-sm" value={editor.content} onChange={(event) => setEditor({ ...editor, content: event.target.value })} />
          <ActionButton onClick={save}>Save File</ActionButton>
        </form>
      </Modal>

      <Modal open={rename.open} onClose={() => setRename({ open: false, from: "", to: "" })} title="Rename Path" description="Moves the entry within the allowed project root.">
        <form onSubmit={renamePath} className="grid gap-4">
          <label>
            <span className="text-sm font-medium">From</span>
            <input className="input mt-1" value={rename.from} onChange={(event) => setRename({ ...rename, from: event.target.value })} />
          </label>
          <label>
            <span className="text-sm font-medium">To</span>
            <input className="input mt-1" value={rename.to} onChange={(event) => setRename({ ...rename, to: event.target.value })} />
          </label>
          <ActionButton onClick={renamePath}>Rename</ActionButton>
        </form>
      </Modal>
    </Shell>
  );
}
