"use client";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { ActionButton } from "../../components/ActionButton";
import { apiFetch, humanDate } from "../../lib/api";
import { titleize, statusBadge } from "../../lib/format";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(["owner", "admin", "developer", "database_manager", "viewer"]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "developer" });
  async function load() { setError(""); try { const [u, r] = await Promise.all([apiFetch("/users"), apiFetch("/roles")]); setUsers(u.users || []); setRoles((r.roles || []).map((role) => role.name)); } catch (err) { setError(err.message); } }
  useEffect(() => { load(); }, []);
  async function create(event) { event.preventDefault(); setError(""); setMessage(""); try { await apiFetch("/users", { method: "POST", body: { name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password, role: form.role } }); setMessage("User created securely."); setOpen(false); setForm({ name: "", email: "", password: "", role: "developer" }); await load(); } catch (err) { setError(err.message); } }
  async function setStatus(id, status) { try { await apiFetch(`/users/${id}/status`, { method: "PATCH", body: { status } }); await load(); } catch (err) { setError(err.message); } }
  const filtered = useMemo(() => users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase())), [users, query]);
  return <Shell>
    <PageHeader title="Users" description="Manage users, roles, status, sessions and 2FA readiness." action={<ActionButton onClick={() => setOpen(true)}>New User</ActionButton>} />
    {message ? <div className="mb-4"><Notice type="success">{message}</Notice></div> : null}{error ? <div className="mb-4"><Notice type="error">{error}</Notice></div> : null}
    <div className="card mb-4 grid gap-3 md:grid-cols-[1fr_auto]"><input className="input" placeholder="Search users by name or email..." value={query} onChange={(e)=>setQuery(e.target.value)} /><div className="text-sm text-slate-500 dark:text-slate-400">{filtered.length} user(s)</div></div>
    <DataTable columns={[{ key:"name", label:"Name" }, { key:"email", label:"Email" }, { key:"role", label:"Roles", render:(row)=>row.roles?.map((item)=>titleize(item.role?.name || item)).join(", ") || "-" }, { key:"twoFactorOn", label:"2FA", render:(row)=><span className={`badge badge-${row.twoFactorOn ? "running" : "warning"}`}>{row.twoFactorOn ? "Enabled" : "Not enabled"}</span> }, { key:"status", label:"Status", render:(row)=><span className={`badge badge-${statusBadge(row.status)}`}>{titleize(row.status)}</span> }, { key:"lastLoginAt", label:"Last login", render:(row)=>humanDate(row.lastLoginAt) }, { key:"actions", label:"Actions", render:(row)=><ActionButton variant="secondary" onClick={()=>setStatus(row.id, row.status === "active" ? "disabled" : "active")}>{row.status === "active" ? "Disable" : "Enable"}</ActionButton> }]} rows={filtered} empty="No users found." />
    <Modal open={open} onClose={() => setOpen(false)} title="New User" description="Create a panel user and assign a readable role.">
      <form onSubmit={create} className="grid gap-4 md:grid-cols-2">
        {[ ["name","Name","text"], ["email","Email","email"], ["password","Password","password"] ].map(([key,label,type]) => <label key={key} className="block"><span className="text-sm font-medium">{label}</span><input className="input mt-1" type={type} value={form[key]} onChange={(e)=>setForm({ ...form, [key]: e.target.value })} required /></label>)}
        <label className="block"><span className="text-sm font-medium">Role</span><select className="input mt-1" value={form.role} onChange={(e)=>setForm({ ...form, role: e.target.value })}>{roles.map((role)=><option key={role} value={role}>{titleize(role)}</option>)}</select></label>
        <div className="md:col-span-2"><ActionButton onClick={create}>Create User</ActionButton></div>
      </form>
    </Modal>
  </Shell>;
}
