import { useEffect, useMemo, useState } from "react";
import { Eye, KeyRound, LogOut, Monitor, Pencil, RefreshCw, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useStore } from "../store";
import { Avatar, Badge, Button, Card, CardHead, ConfirmButton, Empty, Field, Input, Modal, PageHeader, SearchBox, Tabs, Td, Th, Toggle } from "../components/ui";
import { ago, timeFull } from "../lib/format";
import { proxyFetch } from "../lib/api";
import { cn } from "../utils/cn";
import type { Perm, Staff as StaffT } from "../types";

const STAFF_MODULES: { id: string; label: string; actions: ("view" | "create" | "edit" | "delete")[] }[] = [
  { id: "orders", label: "Orders", actions: ["view", "edit", "delete"] },
  { id: "products", label: "Products", actions: ["view", "create", "edit", "delete"] },
  { id: "reviews", label: "Reviews", actions: ["view", "edit", "delete"] },
  { id: "categories", label: "Categories", actions: ["view", "create", "edit", "delete"] },
  { id: "promos", label: "Promo codes", actions: ["view", "create", "edit", "delete"] },
  { id: "banners", label: "Banners", actions: ["view", "create", "edit", "delete"] },
  { id: "sections", label: "Homepage sections", actions: ["view", "create", "edit", "delete"] },
  { id: "delivery", label: "Delivery zones", actions: ["view", "create", "edit", "delete"] },
  { id: "addons", label: "Add-ons", actions: ["view", "create", "edit", "delete"] },
  { id: "brands", label: "Brands", actions: ["view", "create", "edit", "delete"] },
  { id: "settings", label: "Settings", actions: ["view", "edit"] },
];

const none = (): Record<string, Perm> =>
  Object.fromEntries(STAFF_MODULES.map((m) => [m.id, { view: false, create: false, edit: false, delete: false }]));

// Default Staff Permission Policy: ONLY Orders has View + Edit enabled; Delete is OFF by default.
const defaultOrdersOnly = (): Record<string, Perm> => {
  const p = none();
  p.orders = { view: true, create: false, edit: true, delete: false };
  return p;
};

const PRESETS: { name: string; desc: string; f: () => Record<string, Perm> }[] = [
  {
    name: "Default Order Handler",
    desc: "Orders: View & Edit only (Delete OFF)",
    f: defaultOrdersOnly,
  },
  {
    name: "Catalog Editor",
    desc: "Products, Categories, Banners, Sections (No Delete)",
    f: () => {
      const p = defaultOrdersOnly();
      ["products", "categories", "banners", "sections"].forEach((m) => (p[m] = { view: true, create: true, edit: true, delete: false }));
      return p;
    },
  },
  {
    name: "View-Only Analyst",
    desc: "View Orders, Products & Reviews only",
    f: () => {
      const p = none();
      ["orders", "products", "reviews"].forEach((m) => (p[m] = { view: true, create: false, edit: false, delete: false }));
      return p;
    },
  },
  {
    name: "Full Manager (No Delete)",
    desc: "View, Create & Edit across store modules",
    f: () => {
      const p = none();
      STAFF_MODULES.forEach((m) => (p[m.id] = { view: true, create: m.actions.includes("create"), edit: true, delete: false }));
      return p;
    },
  },
];

export function Staff() {
  const { staff, sessions, logs, masterStatus, reloadAll, toast, log, t, setAuthUser } = useStore();
  const [tab, setTab] = useState<"team" | "master" | "sessions" | "logs">("team");
  const [edit, setEdit] = useState<(StaffT & { password?: string }) | null>(null);
  const [q, setQ] = useState("");
  const [pwd, setPwd] = useState({ username: masterStatus.username || "", cur: "", next: "", pin: "" });
  const [tgForm, setTgForm] = useState({ botToken: "", chatId: "", curPass: "" });
  const [delModal, setDelModal] = useState<{ open: boolean; step: 1 | 2; curPass: string; challengeId: string; otp: string }>({
    open: false, step: 1, curPass: "", challengeId: "", otp: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (masterStatus.username) setPwd((p) => ({ ...p, username: masterStatus.username }));
  }, [masterStatus.username]);

  const summary = (s: StaffT) => {
    const m = Object.entries(s.perms || {})
      .filter(([, p]) => p?.view)
      .map(([k, p]) => {
        const acts = ["view", p.create && "create", p.edit && "edit", p.delete && "del"].filter(Boolean).join("/");
        return `${k} (${acts})`;
      });
    return m.length ? m.slice(0, 3).join(", ") + (m.length > 3 ? ` +${m.length - 3}` : "") : "No access";
  };

  const filteredLogs = useMemo(
    () => logs.items.filter((l) => !q || (l.actor + l.action + l.target).toLowerCase().includes(q.toLowerCase())),
    [logs.items, q]
  );

  const saveStaff = async () => {
    if (!edit) return;
    if (!edit.name.trim() || !edit.email.trim()) return toast("Name and login email are required", "err");
    if (!edit.id && (edit.password || "").length < 6) return toast("Password needs at least 6 characters", "err");
    if (!edit.tg.trim()) return toast("Telegram chat ID is required for Staff 2FA OTP", "err");
    setBusy(true);
    try {
      const res = await proxyFetch("/staff", {
        action: "save",
        id: edit.id || "",
        name: edit.name.trim(),
        email: edit.email.trim().toLowerCase(),
        telegram_chat_id: edit.tg.trim(),
        password: edit.password || "",
        permissions: edit.perms,
      });
      if (!res?.success) return toast(res?.error || "Failed to save staff account", "err");
      toast("Staff account saved ✔");
      log("Staff saved", edit.email);
      setEdit(null);
      reloadAll();
    } catch (e: any) {
      toast(e?.message || "Failed to save staff", "err");
    } finally {
      setBusy(false);
    }
  };

  const toggleStaffActive = async (s: StaffT) => {
    try {
      const res = await proxyFetch("/staff", { action: "toggle", id: s.id });
      if (!res?.success) return toast(res?.error || "Failed to toggle staff", "err");
      staff.update(s.id, { active: Boolean(res.is_active) });
      toast(res.is_active ? "Staff account enabled" : "Staff account disabled");
    } catch (e: any) {
      toast(e?.message || "Toggle failed", "err");
    }
  };

  const togglePerm = (m: string, k: keyof Perm) => {
    if (!edit) return;
    const cur = edit.perms[m] || { view: false, create: false, edit: false, delete: false };
    const nextVal = !cur[k];
    const nextPerm: Perm = { ...cur, [k]: nextVal };
    if (k === "view" && !nextVal) {
      nextPerm.create = false;
      nextPerm.edit = false;
      nextPerm.delete = false;
    } else if (k !== "view" && nextVal) {
      nextPerm.view = true;
    }
    setEdit({ ...edit, perms: { ...edit.perms, [m]: nextPerm } });
  };

  const updateMasterSecurity = async (clearPin = false) => {
    if (!pwd.cur) return toast("Enter your current Master password", "err");
    if (pwd.next && pwd.next.length < 8) return toast("New password must be at least 8 characters", "err");
    setBusy(true);
    try {
      const res = await proxyFetch("/master-security", {
        action: "update_credentials",
        current_password: pwd.cur,
        new_username: pwd.username.trim(),
        new_password: pwd.next,
        new_pin: clearPin ? "" : pwd.pin,
        clear_pin: clearPin,
      });
      if (!res?.success) return toast(res?.error || "Update failed", "err");
      if (res.token) localStorage.setItem("admin_token", String(res.token));
      toast(res.message || "Master security updated ✔");
      setPwd((p) => ({ ...p, cur: "", next: "", pin: "" }));
      reloadAll();
    } catch (e: any) {
      toast(e?.message || "Update failed", "err");
    } finally {
      setBusy(false);
    }
  };

  const saveAndTestTelegram2Fa = async () => {
    const curPass = tgForm.curPass || pwd.cur;
    if (!curPass) return toast("Enter your current Master password first", "err");
    setBusy(true);
    try {
      const res = await proxyFetch("/master-security", {
        action: "save_telegram",
        current_password: curPass,
        bot_token: tgForm.botToken.trim(),
        master_chat_id: tgForm.chatId.trim(),
      });
      if (!res?.success) return toast(res?.error || "Telegram 2FA save failed", "err");
      toast(res.message || "Telegram 2FA saved & test OTP sent ✔");
      setTgForm({ botToken: "", chatId: "", curPass: "" });
      reloadAll();
    } catch (e: any) {
      toast(e?.message || "Telegram test failed", "err");
    } finally {
      setBusy(false);
    }
  };

  const forceLogoutAllDevices = async () => {
    setBusy(true);
    try {
      const res = await proxyFetch("/master-security", { action: "revoke_all" });
      if (!res?.success) return toast(res?.error || "Failed to revoke sessions", "err");
      toast(res.message || "All devices signed out ✔");
      localStorage.removeItem("admin_token");
      setAuthUser(null);
    } catch (e: any) {
      toast(e?.message || "Error revoking sessions", "err");
    } finally {
      setBusy(false);
    }
  };

  const requestDeleteMasterOtp = async () => {
    if (!delModal.curPass) return toast("Enter your current Master password", "err");
    setBusy(true);
    try {
      const res = await proxyFetch("/master-security", {
        action: "request_delete_otp",
        current_password: delModal.curPass,
      });
      if (!res?.success) return toast(res?.error || "Could not send delete OTP", "err");
      setDelModal((d) => ({ ...d, step: 2, challengeId: String(res.challenge_id || "") }));
      toast(res.message || "OTP sent to your Telegram");
    } catch (e: any) {
      toast(e?.message || "Failed to request OTP", "err");
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteMaster = async () => {
    if (!delModal.otp || delModal.otp.length < 6) return toast("Enter the 6-digit Telegram OTP", "err");
    setBusy(true);
    try {
      const res = await proxyFetch("/master-security", {
        action: "delete_master",
        current_password: delModal.curPass,
        challenge_id: delModal.challengeId,
        otp_code: delModal.otp.trim(),
      });
      if (!res?.success) return toast(res?.error || "Delete failed", "err");
      toast(res.message || "Master ID deleted");
      localStorage.removeItem("admin_token");
      setAuthUser(null);
    } catch (e: any) {
      toast(e?.message || "Delete failed", "err");
    } finally {
      setBusy(false);
    }
  };

  const clearAuditLogs = async () => {
    try {
      const res = await proxyFetch("/staff-logs", { action: "clear" });
      if (res?.success) {
        logs.set(() => []);
        toast("Activity logs cleared");
      }
    } catch (e: any) {
      toast(e?.message || "Failed to clear logs", "err");
    }
  };

  return (
    <div>
      <PageHeader
        icon={<ShieldCheck size={22} />}
        title={t("Staff & security", "স্টাফ ও সিকিউরিটি")}
        desc="Granular module permissions (View, Create, Edit, Delete), Telegram 2FA and AlwaysData audit logs."
        actions={
          <div className="flex items-center gap-2">
            <Button icon={<RefreshCw size={14} />} onClick={() => reloadAll()}>Refresh</Button>
            {tab === "team" && (
              <Button
                variant="primary"
                icon={<UserPlus size={16} />}
                onClick={() => setEdit({ id: "", name: "", email: "", tg: "", perms: defaultOrdersOnly(), lastLogin: "", active: true })}
              >
                Add staff
              </Button>
            )}
          </div>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-5"
        tabs={[
          { id: "team", label: "Team", count: staff.items.length },
          { id: "master", label: "Master security" },
          { id: "sessions", label: "Active sessions", count: sessions.items.length },
          { id: "logs", label: "Activity log", count: logs.items.length },
        ]}
      />

      {tab === "team" && (
        staff.items.length === 0 ? (
          <Card>
            <Empty
              title="No staff accounts yet"
              sub="Add staff members with their Telegram Chat ID for 2FA and granular View / Create / Edit / Delete permissions."
              action={<Button variant="primary" icon={<UserPlus size={15} />} onClick={() => setEdit({ id: "", name: "", email: "", tg: "", perms: defaultOrdersOnly(), lastLogin: "", active: true })}>Add first staff</Button>}
            />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {staff.items.map((s) => (
              <Card key={s.id} className={cn("p-5", !s.active && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <Avatar name={s.name} size={46} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="truncate text-xs text-slate-500">{s.email}</div>
                  </div>
                  <Toggle checked={s.active} onChange={() => toggleStaffActive(s)} />
                </div>
                <div className="mt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-2"><span className="text-slate-500 shrink-0">Can access</span><span className="truncate font-medium text-right">{summary(s)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Last login</span><span className="font-medium">{s.lastLogin ? ago(s.lastLogin) : "Never"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Telegram 2FA</span><Badge tone="green">Chat: {s.tg || "Set"}</Badge></div>
                </div>
                <div className="mt-4 flex gap-1.5">
                  <Button size="sm" className="flex-1" icon={<Pencil size={13} />} onClick={() => setEdit({ ...structuredClone(s) })}>Edit access</Button>
                  <ConfirmButton onConfirm={() => { staff.remove(s.id); toast("Staff removed"); }}><Trash2 size={15} /></ConfirmButton>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {tab === "master" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHead
              title="Master admin login security"
              sub="Stored in AlwaysData Private Storage (PBKDF2-SHA256). 1 Master ID per site until deleted."
              right={
                <div className="flex gap-1.5">
                  <Badge tone={masterStatus.tgConfigured ? "green" : "amber"} dot>
                    TG 2FA: {masterStatus.tgConfigured ? "Active" : "Unset"}
                  </Badge>
                  <Badge tone={masterStatus.hasPin ? "indigo" : "slate"}>
                    PIN: {masterStatus.hasPin ? "On" : "Off"}
                  </Badge>
                </div>
              }
            />
            <div className="space-y-4 px-5 pb-5">
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
                Passwords & 2FA PIN are stored as <b>PBKDF2-SHA256</b> hashes in AlwaysData Private Storage. A site can only create <b>1 Master Admin ID once</b> — it remains locked until explicitly deleted via Telegram OTP.
              </div>
              <Field label="Master Username / Email">
                <Input value={pwd.username} onChange={(e) => setPwd({ ...pwd, username: e.target.value })} placeholder="admin@yourdomain.com" />
              </Field>
              <Field label="Current password" required hint="Required for any security or Telegram 2FA change">
                <Input type="password" value={pwd.cur} onChange={(e) => setPwd({ ...pwd, cur: e.target.value })} placeholder="••••••••" />
              </Field>
              <Field label="New password" hint="Leave empty to keep current password (min 8 characters)">
                <Input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} placeholder="Min 8 characters" />
              </Field>
              <Field label="2FA Master Security PIN" hint="4–8 digits. Leave empty to keep current PIN.">
                <div className="flex gap-2">
                  <Input
                    inputMode="numeric"
                    value={pwd.pin}
                    onChange={(e) => setPwd({ ...pwd, pin: e.target.value.replace(/\D/g, "") })}
                    maxLength={8}
                    placeholder="e.g. 482910"
                  />
                  {masterStatus.hasPin && (
                    <Button disabled={busy} onClick={() => updateMasterSecurity(true)}>Clear PIN</Button>
                  )}
                </div>
              </Field>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button variant="primary" disabled={busy} icon={<KeyRound size={15} />} onClick={() => updateMasterSecurity(false)}>
                  Update Master Security
                </Button>
                <Button
                  variant="danger"
                  disabled={busy}
                  icon={<Trash2 size={15} />}
                  onClick={() => setDelModal({ open: true, step: 1, curPass: pwd.cur, challengeId: "", otp: "" })}
                >
                  Delete Master ID
                </Button>
              </div>
            </div>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHead
                title="Master Telegram 2FA Settings"
                sub={`Current Chat: ${masterStatus.tgChatMasked || "Not set"} (Source: ${masterStatus.tgSource || "env"})`}
              />
              <div className="space-y-4 px-5 pb-5">
                <Field label="Telegram Bot Token" hint="Leave empty to keep existing Bot Token">
                  <Input type="password" value={tgForm.botToken} onChange={(e) => setTgForm({ ...tgForm, botToken: e.target.value })} placeholder="123456:ABC-DEF…" />
                </Field>
                <Field label="Master Telegram Chat ID">
                  <Input value={tgForm.chatId} onChange={(e) => setTgForm({ ...tgForm, chatId: e.target.value })} placeholder="e.g. 5513474694" />
                </Field>
                {!pwd.cur && (
                  <Field label="Current Master Password (to authorize change)">
                    <Input type="password" value={tgForm.curPass} onChange={(e) => setTgForm({ ...tgForm, curPass: e.target.value })} placeholder="••••••••" />
                  </Field>
                )}
                <Button disabled={busy} onClick={saveAndTestTelegram2Fa}>💾 Save & Test Telegram OTP</Button>
              </div>
            </Card>

            <Card className="border-rose-200">
              <CardHead title={<span className="text-rose-700">Emergency Session Revocation</span>} sub="Immediately invalidates every active token and rotates the signing key." />
              <div className="px-5 pb-5">
                <Button variant="danger" disabled={busy} icon={<LogOut size={15} />} onClick={forceLogoutAllDevices}>
                  Force Logout All Devices
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "sessions" && (
        <Card className="overflow-hidden">
          <CardHead title="Active Admin-Only Sessions (AlwaysData admin_sessions.json)" sub="Only verified admins get a session — regular visitors never do." />
          {sessions.items.length === 0 ? (
            <Empty title="No active sessions" sub="Everyone is signed out." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><Th>Admin / Staff</Th><Th>Device / Browser</Th><Th>IP address</Th><Th>Expires</Th><Th /></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.items.map((s) => (
                    <tr key={s.id}>
                      <Td>
                        <div className="flex items-center gap-2">
                          <Avatar name={s.who} size={30} />
                          <div>
                            <div className="flex items-center gap-1.5 font-medium">
                              <span>{s.who}</span>
                              {s.isCurrent && <Badge tone="green">This Browser</Badge>}
                            </div>
                            <Badge tone={s.role === "Master" ? "violet" : "slate"}>{s.role}</Badge>
                          </div>
                        </div>
                      </Td>
                      <Td className="max-w-xs"><span className="inline-flex items-center gap-1.5 break-all text-xs"><Monitor size={14} className="shrink-0 text-slate-400" />{s.device}</span></Td>
                      <Td className="font-mono text-xs">{s.ip}</Td>
                      <Td className="whitespace-nowrap text-xs">{timeFull(s.expires)}</Td>
                      <Td className="text-right"><Button size="sm" onClick={() => { sessions.remove(s.id); toast("Session revoked"); }}>Revoke</Button></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "logs" && (
        <Card className="overflow-hidden">
          <CardHead
            title="Change & Activity Logs (AlwaysData Storage)"
            sub="Every login, OTP challenge and admin modification is recorded"
            right={
              <>
                <SearchBox value={q} onChange={setQ} placeholder="Search actor / action…" className="w-56" />
                <ConfirmButton label="Clear all?" onConfirm={clearAuditLogs}><Trash2 size={15} /></ConfirmButton>
              </>
            }
          />
          {filteredLogs.length === 0 ? (
            <Empty title="No activity logs" />
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10"><tr><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Target / Details</Th><Th>IP</Th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((l) => (
                    <tr key={l.id}>
                      <Td className="whitespace-nowrap text-xs text-slate-500">{timeFull(l.time)}</Td>
                      <Td><span className="font-medium">{l.actor}</span> <Badge tone={l.role === "Master" ? "violet" : "slate"}>{l.role}</Badge></Td>
                      <Td className="font-mono text-xs font-semibold">{l.action}</Td>
                      <Td className="max-w-md break-words font-mono text-xs">{l.target}</Td>
                      <Td className="font-mono text-xs text-slate-400">{l.ip}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Add / Edit Staff Modal with 4-Column Permission Matrix (View | Create | Edit | Delete) */}
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        wide
        title={edit?.id ? `Edit Staff: ${edit.name}` : "Add Staff Account"}
        sub="Default policy: only Orders has View + Edit enabled, Delete is OFF. Customize granular permissions per module below."
        footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" disabled={busy} onClick={saveStaff}>{busy ? "Saving…" : "Save Staff Account"}</Button></>}
      >
        {edit && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Staff full name" required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Rahim Manager" autoFocus /></Field>
              <Field label="Login email / username" required><Input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} placeholder="staff@yourdomain.com" /></Field>
              <Field label="Staff Telegram Chat ID" required hint="2FA login OTP will be sent to this Telegram ID"><Input value={edit.tg} onChange={(e) => setEdit({ ...edit, tg: e.target.value })} placeholder="e.g. 7670553204" /></Field>
              <Field label={edit.id ? "New password (leave blank to keep)" : "Password (min 6 chars)"} required={!edit.id}><Input type="password" value={edit.password || ""} onChange={(e) => setEdit({ ...edit, password: e.target.value })} placeholder="Min 6 characters" /></Field>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold">Quick permission presets</div>
              <div className="grid gap-2 sm:grid-cols-4">
                {PRESETS.map((p) => (
                  <button key={p.name} type="button" onClick={() => setEdit({ ...edit, perms: p.f() })} className="rounded-xl border border-slate-200 p-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40">
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-[11px] text-slate-500">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <Th>Module</Th>
                    <Th className="text-center"><Eye size={13} className="mx-auto inline mr-1" />View</Th>
                    <Th className="text-center">Create</Th>
                    <Th className="text-center">Edit</Th>
                    <Th className="text-center">Delete</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {STAFF_MODULES.map((m) => (
                    <tr key={m.id}>
                      <Td className="font-medium">{m.label}</Td>
                      {(["view", "create", "edit", "delete"] as const).map((k) => {
                        const supported = m.actions.includes(k);
                        return (
                          <Td key={k} className="text-center">
                            {supported ? (
                              <input
                                type="checkbox"
                                checked={Boolean(edit.perms[m.id]?.[k])}
                                onChange={() => togglePerm(m.id, k)}
                                className="h-4 w-4 accent-indigo-600 cursor-pointer"
                              />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </Td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Master ID Modal (Requires Password + Telegram OTP) */}
      <Modal
        open={delModal.open}
        onClose={() => setDelModal({ open: false, step: 1, curPass: "", challengeId: "", otp: "" })}
        title="🗑 Delete Master Admin ID"
        sub="Deleting the current Master ID unlocks 1-time creation of a new Master Admin on next login."
        footer={
          <>
            <Button onClick={() => setDelModal({ open: false, step: 1, curPass: "", challengeId: "", otp: "" })}>Cancel</Button>
            {delModal.step === 1 ? (
              <Button variant="danger" disabled={busy} onClick={requestDeleteMasterOtp}>Send Telegram OTP</Button>
            ) : (
              <Button variant="danger" disabled={busy} onClick={confirmDeleteMaster}>Verify OTP & Delete Master ID</Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Current Master Password" required>
            <Input
              type="password"
              value={delModal.curPass}
              onChange={(e) => setDelModal({ ...delModal, curPass: e.target.value })}
              placeholder="Enter current Master password"
            />
          </Field>
          {delModal.step === 2 && (
            <Field label="6-Digit Telegram OTP" required hint="Enter the delete confirmation OTP sent to your Telegram">
              <Input
                inputMode="numeric"
                maxLength={6}
                value={delModal.otp}
                onChange={(e) => setDelModal({ ...delModal, otp: e.target.value.replace(/\D/g, "") })}
                placeholder="••••••"
                className="text-center text-xl tracking-[.4em]"
                autoFocus
              />
            </Field>
          )}
        </div>
      </Modal>
    </div>
  );
}
