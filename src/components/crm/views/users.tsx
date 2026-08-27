"use client";
import { useEffect, useState } from "react";
import { api, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ShieldCheck, Users as UsersIcon, KeyRound } from "lucide-react";
import { PageHeader, DataTable, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";
import { ROLES } from "@/lib/constants";

type User = { id: string; name: string; email: string; phone?: string | null; role: { id: string; name: string }; isActive: boolean; lastLoginAt?: string | null; createdAt: string };
type Role = { id: string; name: string; description?: string | null; isSystem: boolean; permissions: string[]; userCount: number };

export function UsersView() {
  const { user, navigate } = useCrmStore();
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPerms, setAllPerms] = useState<string[]>([]);

  async function loadUsers() {
    setLoading(true);
    try {
      const r = await api.get<{ items: User[]; total: number }>(`/api/v1/users?search=${encodeURIComponent(search)}&page=${page}&limit=15`);
      setUsers(r.items); setTotal(r.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  async function loadRoles() {
    try {
      const r = await api.get<{ items: Role[]; allPermissions: string[] }>("/api/v1/roles");
      setRoles(r.items); setAllPerms(r.allPermissions);
    } catch (e) { toast.error((e as Error).message); }
  }

  useEffect(() => { if (tab === "users") loadUsers(); else loadRoles(); }, [tab, page, search]);

  async function createUser(data: any) {
    try { await api.post("/api/v1/users", data); toast.success("User created"); setOpen(false); loadUsers(); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function toggleActive(u: User) {
    try { await api.put(`/api/v1/users/${u.id}`, { isActive: !u.isActive }); toast.success("Updated"); loadUsers(); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function updateRolePerms(role: Role, perms: string[]) {
    try { await api.patch(`/api/v1/roles/${role.id}`, { permissions: perms }); toast.success("Role updated"); loadRoles(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Users & Roles" description="Role-based access control enforced on every API endpoint." />
      <div className="flex gap-1 mb-4 border-b">
        <button onClick={() => setTab("users")} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "users" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><UsersIcon className="h-4 w-4 inline mr-1" /> Users</button>
        <button onClick={() => setTab("roles")} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "roles" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><KeyRound className="h-4 w-4 inline mr-1" /> Roles</button>
      </div>

      {tab === "users" ? (
        <div>
          <div className="flex justify-end mb-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New User</Button></DialogTrigger>
              <DialogContent><UserForm onCreate={createUser} /></DialogContent>
            </Dialog>
          </div>
          <DataTable<User>
            rows={users} loading={loading} page={page} totalPages={Math.ceil(total / 15) || 1} total={total} limit={15}
            onPage={setPage} search={search} onSearch={setSearch}
            columns={[
              { key: "name", header: "Name", render: (r) => <div><div className="font-medium">{r.name}{r.id === user?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</div><div className="text-xs text-muted-foreground">{r.email}</div></div> },
              { key: "phone", header: "Phone", render: (r) => r.phone || "—" },
              { key: "role", header: "Role", render: (r) => <StatusBadge status={r.role.name} /> },
              { key: "active", header: "Active", render: (r) => <StatusBadge status={r.isActive ? "ACTIVE" : "INACTIVE"} /> },
              { key: "last", header: "Last Login", render: (r) => r.lastLoginAt ? <span className="text-xs">{formatDate(r.lastLoginAt)}</span> : "—" },
              { key: "actions", header: "", render: (r) => <Button variant="outline" size="sm" className="h-7" disabled={r.id === user?.id} onClick={(e) => { e.stopPropagation(); toggleActive(r); }}>{r.isActive ? "Deactivate" : "Activate"}</Button> },
            ]}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((r) => <RoleCard key={r.id} role={r} allPerms={allPerms} onSave={(p) => updateRolePerms(r, p)} />)}
        </div>
      )}
    </div>
  );
}

function UserForm({ onCreate }: { onCreate: (data: any) => void }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", roleName: "SALES", isActive: true });
  return (
    <div>
      <DialogHeader><DialogTitle>New User</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><Label>Password</Label><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        </div>
        <div><Label>Role</Label>
          <Select value={f.roleName} onValueChange={(v) => setF({ ...f, roleName: v })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={() => onCreate(f)} disabled={!f.name || !f.email || !f.password}>Create User</Button>
      </div>
    </div>
  );
}

function RoleCard({ role, allPerms, onSave }: { role: Role; allPerms: string[]; onSave: (perms: string[]) => void }) {
  const [perms, setPerms] = useState<string[]>(role.permissions);
  const [open, setOpen] = useState(false);

  function toggle(p: string) {
    setPerms((cur) => cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]);
  }

  // Group permissions by module
  const grouped: Record<string, string[]> = {};
  for (const p of allPerms) {
    const mod = p.split(":")[0];
    if (!grouped[mod]) grouped[mod] = [];
    grouped[mod].push(p);
  }

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-medium">{role.name}</span>
            {role.isSystem && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">SYSTEM</span>}
            <span className="text-xs text-muted-foreground">{role.userCount} user(s)</span>
          </div>
          {role.description && <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>}
        </div>
        {!role.isSystem && <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>{open ? "Cancel" : "Edit"}</Button>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {perms.map((p) => <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{p}</span>)}
      </div>
      {open && !role.isSystem && (
        <div className="mt-3 border-t pt-3">
          <div className="grid sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
            {Object.entries(grouped).map(([mod, list]) => (
              <div key={mod} className="rounded border p-2">
                <div className="text-xs font-semibold capitalize mb-1">{mod}</div>
                <div className="space-y-1">
                  {list.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={perms.includes(p)} onChange={() => toggle(p)} />
                      <span>{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Button size="sm" className="mt-2" onClick={() => onSave(perms)}>Save Permissions</Button>
        </div>
      )}
      <div className="mt-2 text-xs text-muted-foreground">{role.permissions.length} of {allPerms.length} permissions</div>
    </div>
  );
}
