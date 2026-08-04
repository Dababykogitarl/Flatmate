"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api, apiUrl, ApiDuty, ApiExpense, ApiGroup, ApiInvitation, ApiInviteInfo, ApiMember, ApiNotification, ApiUser } from "./api";

type Tab = "Home" | "Duties" | "Expenses" | "Groups" | "Members";
type Recurrence = "once" | "daily" | "weekly" | "monthly";
type Duty = {
  id: string | number;
  title: string;
  area: string;
  assigneeId: string;
  dueAt: string;
  recurrence: Recurrence;
  groupId: string | null;
  done: boolean;
};
type MemberView = { id: string; name: string; email: string; initials: string; role: "Primary" | "Member"; color: string; joined: boolean };
type ExpenseView = { id: string | number; title: string; paidBy: string; amount: number; yourShare: number; date: string; settled: boolean };
type GroupView = { id: string; name: string; parentGroupId: string | null; memberIds: string[] };

const demoMembers: MemberView[] = [
  { id: "demo-monica", name: "Monica", email: "monica@example.com", initials: "MG", role: "Primary", color: "coral", joined: true },
  { id: "demo-rachel", name: "Rachel", email: "rachel@example.com", initials: "RG", role: "Member", color: "blue", joined: true },
  { id: "demo-phoebe", name: "Phoebe", email: "phoebe@example.com", initials: "PB", role: "Member", color: "mint", joined: true },
  { id: "demo-joey", name: "Joey", email: "joey@example.com", initials: "JT", role: "Member", color: "yellow", joined: true },
  { id: "demo-ross", name: "Ross", email: "ross@example.com", initials: "GG", role: "Member", color: "blue", joined: true },
  { id: "demo-chandler", name: "Chandler", email: "chandler@example.com", initials: "CB", role: "Member", color: "mint", joined: true },
];
const demoGroups: GroupView[] = [
  { id: "group-kitchen", name: "Kitchen crew", parentGroupId: null, memberIds: ["demo-monica", "demo-rachel", "demo-chandler"] },
  { id: "group-weekend", name: "Weekend deep clean", parentGroupId: "group-kitchen", memberIds: ["demo-monica", "demo-chandler"] },
];
const sixHours = () => new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const initialDuties: Duty[] = [
  { id: 1, title: "Take out the trash", area: "Kitchen", assigneeId: "demo-monica", dueAt: sixHours(), recurrence: "daily", groupId: "group-kitchen", done: false },
  { id: 2, title: "Clean the kitchen", area: "Kitchen", assigneeId: "demo-chandler", dueAt: sixHours(), recurrence: "weekly", groupId: "group-weekend", done: false },
  { id: 3, title: "Mop common areas", area: "Living room", assigneeId: "demo-joey", dueAt: tomorrow(), recurrence: "weekly", groupId: null, done: false },
  { id: 4, title: "Bathroom clean", area: "Bathroom", assigneeId: "demo-phoebe", dueAt: sixHours(), recurrence: "weekly", groupId: null, done: true },
  { id: 5, title: "Sort the recycling", area: "Trash & recycling", assigneeId: "demo-ross", dueAt: tomorrow(), recurrence: "weekly", groupId: null, done: false },
  { id: 6, title: "Wipe kitchen counters", area: "Kitchen", assigneeId: "demo-rachel", dueAt: sixHours(), recurrence: "daily", groupId: "group-kitchen", done: false },
];
const navItems: { label: Tab; icon: string }[] = [
  { label: "Home", icon: "⌂" },
  { label: "Duties", icon: "✓" },
  { label: "Expenses", icon: "$" },
  { label: "Groups", icon: "◎" },
  { label: "Members", icon: "♙" },
];

export default function FlatmateApp() {
  const [session, setSession] = useState<ApiUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("Home");
  const [duties, setDuties] = useState<Duty[]>(initialDuties);
  const [members, setMembers] = useState<MemberView[]>(demoMembers);
  const [groups, setGroups] = useState<GroupView[]>(demoGroups);
  const [expenses, setExpenses] = useState<ExpenseView[]>([
    { id: 1, title: "Weekly groceries", paidBy: "Rachel", amount: 90, yourShare: 15, date: "Today", settled: false },
    { id: 2, title: "Wi-Fi — July", paidBy: "You", amount: 60, yourShare: -50, date: "Yesterday", settled: false },
  ]);
  const [currentUserId, setCurrentUserId] = useState("demo-monica");
  const [isPrimary, setIsPrimary] = useState(true);
  const [connection, setConnection] = useState<"checking" | "live" | "offline">("checking");
  const [modal, setModal] = useState<"duty" | "expense" | "invite" | "inviteLink" | "group" | null>(null);
  const [editingDuty, setEditingDuty] = useState<Duty | null>(null);
  const [groupParentId, setGroupParentId] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | "unsupported">(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const seenNotificationIds = useRef(new Set<string>());
  const [inviteUrl, setInviteUrl] = useState("");
  const [toast, setToast] = useState("");

  async function loadWorkspace(user: ApiUser) {
    const [apiMembers, apiGroups, apiDuties, apiExpenses, apiNotifications] = await Promise.all([
      api<ApiMember[]>("/members"),
      api<ApiGroup[]>("/groups"),
      api<ApiDuty[]>("/duties"),
      api<ApiExpense[]>("/expenses"),
      api<ApiNotification[]>("/notifications"),
    ]);
    const colors = ["coral", "blue", "mint", "yellow"];
    const memberViews = apiMembers.map((member, index): MemberView => ({
      id: member.id,
      name: member.name,
      email: member.email,
      initials: member.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      role: member.role === "primary" ? "Primary" : "Member",
      color: colors[index % colors.length],
      joined: Boolean(member.joinedAt),
    }));
    const byId = new Map(memberViews.map((member) => [member.id, member]));
    setMembers(memberViews);
    setGroups(apiGroups.map((group) => ({ id: group.id, name: group.name, parentGroupId: group.parentGroupId, memberIds: group.memberIds })));
    setDuties(apiDuties.map(fromApiDuty));
    setNotifications(apiNotifications);
    seenNotificationIds.current = new Set(apiNotifications.map((item) => item.id));
    setExpenses(apiExpenses.map((expense) => fromApiExpense(expense, user, byId)));
    setCurrentUserId(user.sub);
    setIsPrimary(user.role === "primary");
    setConnection("live");
  }

  useEffect(() => {
    let active = true;
    async function connect() {
      try {
        const result = await api<{ user: ApiUser }>("/auth/me");
        if (!active) return;
        setSession(result.user);
        await loadWorkspace(result.user);
      } catch {
        if (active) {
          setSession(null);
          setConnection("offline");
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    }
    void connect();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      void api<ApiNotification[]>("/notifications").then((items) => {
        const fresh = items.filter((item) => !item.readAt && !seenNotificationIds.current.has(item.id));
        fresh.forEach((item) => {
          seenNotificationIds.current.add(item.id);
          if (browserPermission === "granted") new Notification(item.title, { body: item.message, tag: item.id });
        });
        setNotifications(items);
      }).catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [session, browserPermission]);

  const completed = duties.filter((duty) => duty.done).length;
  const progress = duties.length ? Math.round((completed / duties.length) * 100) : 0;
  const yourBalance = expenses.reduce((sum, item) => sum - item.yourShare, 0);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const currentMember = memberById.get(currentUserId);
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  async function authenticated(user: ApiUser) {
    setAuthLoading(true);
    setSession(user);
    try {
      await loadWorkspace(user);
      window.history.replaceState({}, "", window.location.pathname);
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    setSession(null);
    setNotifications([]);
    setNotificationsOpen(false);
    setConnection("offline");
  }

  async function toggleNotifications() {
    const opening = !notificationsOpen;
    setNotificationsOpen(opening);
    if (opening && unreadCount) {
      await api("/notifications/read-all", { method: "PATCH" }).catch(() => undefined);
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    }
  }

  async function enableBrowserNotifications() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);
    flash(permission === "granted" ? "Desktop notifications enabled while Flatmate is open." : "Notification permission was not enabled.");
  }

  if (authLoading) return <AuthLoading />;
  if (!session) return <AuthScreen onAuthenticated={authenticated} />;

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  function openNewDuty() {
    setEditingDuty(null);
    setModal("duty");
  }

  async function saveDuty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const groupId = String(data.get("groupId") ?? "") || null;
    const payload = {
      title: String(data.get("title")),
      area: String(data.get("area")),
      assigneeId: String(data.get("assigneeId")),
      dueAt: new Date(String(data.get("dueAt"))).toISOString(),
      recurrence: String(data.get("recurrence")) as Recurrence,
      groupId,
    };
    try {
      if (editingDuty) {
        const updated = connection === "live"
          ? await api<ApiDuty>(`/duties/${editingDuty.id}`, { method: "PATCH", body: JSON.stringify(payload) })
          : null;
        setDuties((items) => items.map((item) => item.id === editingDuty.id ? (updated ? fromApiDuty(updated) : { ...item, ...payload, done: false }) : item));
        flash("Duty updated. The new reminder is scheduled.");
      } else {
        const created = connection === "live"
          ? await api<ApiDuty>("/duties", { method: "POST", body: JSON.stringify(payload) })
          : null;
        setDuties((items) => [...items, created ? fromApiDuty(created) : { id: Date.now(), ...payload, done: false }]);
        flash("Duty added and the assignee will be reminded automatically.");
      }
      setEditingDuty(null);
      setModal(null);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not save duty");
    }
  }

  async function completeDuty(id: string | number) {
    const duty = duties.find((item) => item.id === id);
    if (!duty || duty.done) return;
    try {
      const completedDuty = connection === "live" ? await api<ApiDuty>(`/duties/${id}/complete`, { method: "PATCH" }) : null;
      const nextDuty = completedDuty ? fromApiDuty(completedDuty) : { ...duty, done: duty.recurrence === "once", dueAt: nextRecurringDate(duty.dueAt, duty.recurrence) };
      setDuties((items) => items.map((item) => item.id === id ? nextDuty : item));
      const group = duty.groupId ? groupById.get(duty.groupId) : null;
      const recurrenceMessage = duty.recurrence === "once" ? "" : ` Next ${duty.recurrence} occurrence: ${formatDue(nextDuty)}.`;
      flash((group ? `Completed. Only ${group.name} members were notified.` : `Completed. Everyone in ${session?.homeName ?? "the home"} was notified.`) + recurrenceMessage);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not complete duty");
    }
  }

  async function deleteDuty(duty: Duty) {
    if (!window.confirm(`Delete “${duty.title}”?`)) return;
    try {
      if (connection === "live") await api(`/duties/${duty.id}`, { method: "DELETE" });
      setDuties((items) => items.filter((item) => item.id !== duty.id));
      flash("Duty and its scheduled reminder were deleted.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not delete duty");
    }
  }

  async function addGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parentGroupId = String(data.get("parentGroupId") ?? "") || null;
    const memberIds = data.getAll("memberIds").map(String);
    const input = { name: String(data.get("name")), parentGroupId, memberIds };
    try {
      const created = connection === "live"
        ? await api<ApiGroup>("/groups", { method: "POST", body: JSON.stringify(input) })
        : null;
      const group: GroupView = created
        ? { id: created.id, name: created.name, parentGroupId: created.parentGroupId, memberIds: created.memberIds }
        : { id: `group-${Date.now()}`, ...input, memberIds: [...new Set([currentUserId, ...memberIds])] };
      setGroups((items) => [...items, group]);
      setModal(null);
      setGroupParentId(null);
      flash(parentGroupId ? "Private subgroup created." : "Group created.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not create group");
    }
  }

  async function deleteGroup(group: GroupView) {
    if (!window.confirm(`Delete ${group.name} and its nested groups?`)) return;
    try {
      if (connection === "live") await api(`/groups/${group.id}`, { method: "DELETE" });
      const ids = collectGroupIds(groups, group.id);
      setGroups((items) => items.filter((item) => !ids.has(item.id)));
      setDuties((items) => items.filter((item) => !item.groupId || !ids.has(item.groupId)));
      flash("Group, nested groups, and their private duties were deleted.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not delete group");
    }
  }

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amount = Number(data.get("amount"));
    try {
      const created = connection === "live"
        ? await api<ApiExpense>("/expenses", { method: "POST", body: JSON.stringify({ title: String(data.get("title")), amount }) })
        : null;
      const expense = created
        ? fromApiExpense(created, session, memberById)
        : { id: Date.now(), title: String(data.get("title")), paidBy: "You", amount, yourShare: -(amount * 0.75), date: "Just now", settled: false };
      setExpenses((items) => [expense, ...items]);
      setModal(null);
      flash("Expense added and split with the home.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not add expense");
    }
  }

  async function settleExpense(id: string | number) {
    try {
      const updated = await api<ApiExpense>(`/expenses/${id}/splits/${currentUserId}/settle`, { method: "PATCH" });
      setExpenses((items) => items.map((item) => item.id === id ? fromApiExpense(updated, session, memberById) : item));
      flash("Your share was marked paid and the home was notified.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not settle this expense");
    }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    const name = String(data.get("name"));
    try {
      const created = await api<ApiInvitation>("/members", { method: "POST", body: JSON.stringify({ email, name }) });
      const id = created.id;
      setMembers((items) => [...items, {
        id,
        name: created.name,
        email: created.email,
        initials: name.slice(0, 2).toUpperCase(),
        role: "Member",
        color: "mint",
        joined: false,
      }]);
      setInviteUrl(created.inviteUrl);
      setModal("inviteLink");
      void navigator.clipboard?.writeText(created.inviteUrl).catch(() => undefined);
      flash(created.emailDelivery === "sent" ? `Invitation emailed to ${email}.` : `Invitation created for ${email}. Copy and send the private link.`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not invite member");
    }
  }

  async function reinviteMember(id: string) {
    try {
      const invitation = await api<ApiInvitation>(`/members/${id}/reinvite`, { method: "POST" });
      setInviteUrl(invitation.inviteUrl);
      setModal("inviteLink");
      void navigator.clipboard?.writeText(invitation.inviteUrl).catch(() => undefined);
      flash("A fresh invitation link was created.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not recreate invitation");
    }
  }

  async function copyInvitation() {
    await navigator.clipboard.writeText(inviteUrl);
    flash("Invitation link copied.");
  }

  async function removeMember(id: string) {
    try {
      if (connection === "live") await api(`/members/${id}`, { method: "DELETE" });
      setMembers((items) => items.filter((item) => item.id !== id));
      setGroups((items) => items.map((group) => ({ ...group, memberIds: group.memberIds.filter((memberId) => memberId !== id) })));
      flash("Member access removed.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not remove member");
    }
  }

  async function makePrimary(id: string) {
    try {
      if (connection === "live") await api(`/members/${id}/role`, { method: "PATCH", body: JSON.stringify({ role: "primary" }) });
      setMembers((items) => items.map((item) => item.id === id ? { ...item, role: "Primary" } : item));
      flash("Primary access granted.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not change access");
    }
  }

  const title = tab === "Home" ? `Good afternoon, ${session.name}` : tab;
  const addLabel = tab === "Expenses" ? "Add expense" : tab === "Members" ? "Invite member" : tab === "Groups" ? "Add group" : "Add duty";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setTab("Home")} aria-label="Flatmate home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>flatmate<span className="brand-dot">.</span></span>
        </button>
        <div className="home-switcher">
          <div className="house-avatar">{session.homeName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
          <div><strong>{session.homeName}</strong><span>{members.length} flatmates</span></div>
        </div>
        <nav aria-label="Primary navigation">
          {navItems.map((item) => (
            <button key={item.label} className={tab === item.label ? "active" : ""} onClick={() => setTab(item.label)}>
              <span>{item.icon}</span>{item.label}
              {item.label === "Duties" && <b>{duties.filter((duty) => !duty.done).length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-card">
          <span className="spark">✦</span><strong>Right people, right updates</strong>
          <p>Private group activity stays inside that group.</p>
        </div>
        <button className="profile-row" onClick={logout} title="Sign out">
          <span className={`avatar ${currentMember?.color ?? "coral"}`}>{currentMember?.initials ?? session.name.slice(0, 2).toUpperCase()}</span>
          <span><strong>{session.name}</strong><small>{isPrimary ? "Primary member · Sign out" : "Member · Sign out"}</small></span>
        </button>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}</p>
            <h1>{title}{tab === "Home" && <span className="wave">☼</span>}</h1>
            <p>{tab === "Home" ? `Here’s what’s happening at ${session.homeName} today.` : pageSubtitle(tab)}</p>
          </div>
          <div className="top-actions">
            <span className={`connection-pill ${connection}`}>{connection === "live" ? "● API live" : connection === "checking" ? "Connecting…" : "API offline"}</span>
            <button className="icon-button" onClick={toggleNotifications} aria-label={`${unreadCount} unread notifications`}>♢{unreadCount > 0 && <span />}</button>
            <button className="primary-button" disabled={(tab === "Groups" || tab === "Members") && !isPrimary} onClick={() => {
              if (tab === "Expenses") setModal("expense");
              else if (tab === "Members") setModal("invite");
              else if (tab === "Groups") { setGroupParentId(null); setModal("group"); }
              else openNewDuty();
            }}><span>＋</span>{addLabel}</button>
          </div>
          {notificationsOpen && (
            <div className="notification-popover">
              <div className="popover-title"><strong>Notifications</strong><span>{unreadCount ? `${unreadCount} new` : "Up to date"}</span></div>
              {browserPermission !== "granted" && browserPermission !== "unsupported" && <button className="notification-enable" onClick={enableBrowserNotifications}>Enable desktop notifications</button>}
              {notifications.length ? notifications.slice(0, 8).map((notification) => (
                <p key={notification.id}><i className={`status-dot ${notification.type.includes("completed") ? "green" : notification.type.includes("reminder") ? "orange" : "blue-dot"}`} /><span><strong>{notification.title}</strong><small>{notification.message} · {formatRelativeTime(notification.createdAt)}</small></span></p>
              )) : <div className="popover-empty">No notifications yet.</div>}
            </div>
          )}
        </header>

        {tab === "Home" && <Dashboard duties={duties} members={memberById} groups={groupById} completeDuty={completeDuty} progress={progress} completed={completed} expenses={expenses} setTab={setTab} yourBalance={yourBalance} />}
        {tab === "Duties" && <DutiesPage duties={duties} members={memberById} groups={groups} groupById={groupById} completeDuty={completeDuty} editDuty={(duty) => { setEditingDuty(duty); setModal("duty"); }} deleteDuty={deleteDuty} />}
        {tab === "Expenses" && <ExpensesPage expenses={expenses} yourBalance={yourBalance} settleExpense={settleExpense} />}
        {tab === "Groups" && <GroupsPage groups={groups} members={memberById} isPrimary={isPrimary} addSubgroup={(parentId) => { setGroupParentId(parentId); setModal("group"); }} deleteGroup={deleteGroup} />}
        {tab === "Members" && <MembersPage members={members} removeMember={removeMember} makePrimary={makePrimary} reinviteMember={reinviteMember} currentUserId={currentUserId} isPrimary={isPrimary} />}
      </section>

      {toast && <div className="toast"><span>✓</span>{toast}</div>}
      {modal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Close">×</button>
            {modal === "duty" && <DutyForm duty={editingDuty} members={members} groups={groups} onSubmit={saveDuty} />}
            {modal === "group" && <GroupForm parentId={groupParentId} groups={groups} members={members} currentUserId={currentUserId} onSubmit={addGroup} />}
            {modal === "expense" && <ExpenseForm onSubmit={addExpense} />}
            {modal === "invite" && <InviteForm onSubmit={inviteMember} />}
            {modal === "inviteLink" && <InvitationReady inviteUrl={inviteUrl} onCopy={copyInvitation} />}
          </div>
        </div>
      )}
    </main>
  );
}

function fromApiDuty(duty: ApiDuty): Duty {
  return {
    id: duty.id,
    title: duty.title,
    area: duty.area,
    assigneeId: duty.assigneeId,
    dueAt: duty.dueAt,
    recurrence: (duty.recurrence ?? "once") as Recurrence,
    groupId: duty.groupId ?? null,
    done: duty.completed,
  };
}

function fromApiExpense(expense: ApiExpense, user: ApiUser, members: Map<string, MemberView>): ExpenseView {
  const payer = members.get(expense.paidById);
  const ownSplit = expense.splits.find((split) => split.memberId === user.sub);
  const isPayer = expense.paidById === user.sub;
  const outstanding = isPayer
    ? expense.splits.filter((split) => split.memberId !== user.sub && !split.settled).reduce((sum, split) => sum + Number(split.amount), 0)
    : ownSplit && !ownSplit.settled ? Number(ownSplit.amount) : 0;
  return {
    id: expense.id,
    title: expense.title,
    paidBy: isPayer ? "You" : payer?.name ?? "Flatmate",
    amount: Number(expense.amount),
    yourShare: isPayer ? -outstanding : outstanding,
    date: new Date(expense.createdAt).toLocaleDateString([], { month: "short", day: "numeric" }),
    settled: isPayer || Boolean(ownSplit?.settled),
  };
}

function nextRecurringDate(value: string, recurrence: Recurrence) {
  const next = new Date(value);
  if (recurrence === "daily") next.setDate(next.getDate() + 1);
  else if (recurrence === "weekly") next.setDate(next.getDate() + 7);
  else if (recurrence === "monthly") next.setMonth(next.getMonth() + 1);
  return next.toISOString();
}

function pageSubtitle(tab: Tab) {
  if (tab === "Duties") return "Add, edit, schedule, complete, or remove shared duties.";
  if (tab === "Groups") return "Create private groups and nested subgroups with precise access.";
  if (tab === "Members") return "Control who can access your shared home.";
  return "Keep shared expenses visible and easy to settle.";
}

function Dashboard({ duties, members, groups, completeDuty, progress, completed, expenses, setTab, yourBalance }: {
  duties: Duty[];
  members: Map<string, MemberView>;
  groups: Map<string, GroupView>;
  completeDuty: (id: string | number) => void;
  progress: number;
  completed: number;
  expenses: ExpenseView[];
  setTab: (tab: Tab) => void;
  yourBalance: number;
}) {
  return <div className="dashboard-grid">
    <div className="content-column">
      <section className="section-block">
        <div className="section-heading">
          <div><h2>{"Today's duties"}</h2><p>{completed} of {duties.length} completed</p></div>
          <div className="progress-wrap"><span>{progress}%</span><div><i style={{ width: `${progress}%` }} /></div></div>
        </div>
        <div className="duty-list">{duties.slice(0, 4).map((duty) => <DutyRow key={duty.id} duty={duty} member={members.get(duty.assigneeId)} group={duty.groupId ? groups.get(duty.groupId) : undefined} completeDuty={completeDuty} />)}</div>
        <button className="text-link" onClick={() => setTab("Duties")}>Manage all duties <span>→</span></button>
      </section>
      <section className="section-block expense-block">
        <div className="section-heading"><div><h2>Recent expenses</h2><p>Simple splits, no awkward maths</p></div><button className="text-link inline" onClick={() => setTab("Expenses")}>View all →</button></div>
        <div className="expense-list">{expenses.slice(0, 3).map((item) => <ExpenseRow key={item.id} item={item} />)}</div>
      </section>
    </div>
    <aside className="insights-column">
      <section className="balance-card">
        <p>YOUR BALANCE</p><h2>{yourBalance >= 0 ? "+" : "−"}${Math.abs(yourBalance).toFixed(2)}</h2>
        <span>{yourBalance >= 0 ? "You are owed overall" : "You owe overall"}</span>
        <button onClick={() => setTab("Expenses")}>Settle up</button>
      </section>
      <section className="activity-card">
        <div className="section-heading"><div><h2>Private activity</h2><p>Only relevant members are notified</p></div></div>
        <div className="timeline">
          <div className="scope-activity"><span>◎</span><div><strong>Weekend deep clean</strong><small>2 members · subgroup</small></div></div>
          <div className="scope-activity"><span>⌂</span><div><strong>Whole home</strong><small>{members.size} members · shared access</small></div></div>
        </div>
      </section>
      <section className="tip-card"><span>☼</span><div><strong>Small reminder, big peace.</strong><p>Flatmate nudges the right people automatically.</p></div></section>
    </aside>
  </div>;
}

function DutyRow({ duty, member, group, completeDuty, editDuty, deleteDuty }: {
  duty: Duty;
  member?: MemberView;
  group?: GroupView;
  completeDuty: (id: string | number) => void;
  editDuty?: (duty: Duty) => void;
  deleteDuty?: (duty: Duty) => void;
}) {
  return <article className={`duty-row ${duty.done ? "is-done" : ""}`}>
    <div className={`task-icon ${member?.color ?? "blue"}`}>{duty.area === "Kitchen" ? "✦" : duty.area === "Bathroom" ? "◌" : "✓"}</div>
    <div className="task-copy">
      <strong>{duty.title}</strong>
      <span>{duty.area} · {formatDue(duty)} · <b className="recurrence-label">{duty.recurrence}</b></span>
      <small className={group ? "scope-label private" : "scope-label"}>{group ? `◎ ${group.name}` : "⌂ Everyone in this home"}</small>
    </div>
    <div className="assignee"><span className={`avatar ${member?.color ?? "blue"}`}>{member?.initials ?? "FM"}</span><span>{member?.name ?? "Flatmate"}</span></div>
    <div className="duty-actions">
      <button className={duty.done ? "complete-button done" : "complete-button"} onClick={() => completeDuty(duty.id)} disabled={duty.done}>{duty.done ? "✓ Completed" : "Mark complete"}</button>
      {editDuty && <button className="mini-action" onClick={() => editDuty(duty)}>Edit</button>}
      {deleteDuty && <button className="mini-action danger" onClick={() => deleteDuty(duty)}>Delete</button>}
    </div>
  </article>;
}

function formatDue(duty: Duty) {
  if (duty.done) return "Completed";
  return `Due ${new Date(duty.dueAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`;
}

function DutiesPage({ duties, members, groups, groupById, completeDuty, editDuty, deleteDuty }: {
  duties: Duty[];
  members: Map<string, MemberView>;
  groups: GroupView[];
  groupById: Map<string, GroupView>;
  completeDuty: (id: string | number) => void;
  editDuty: (duty: Duty) => void;
  deleteDuty: (duty: Duty) => void;
}) {
  const [schedule, setSchedule] = useState<"all" | Recurrence>("all");
  const [groupId, setGroupId] = useState("all");
  const visible = duties.filter((duty) => (schedule === "all" || duty.recurrence === schedule) && (groupId === "all" || (groupId === "home" ? !duty.groupId : duty.groupId === groupId)));
  return <div className="page-panel">
    <div className="filter-row schedule-filters">
      {(["all", "once", "daily", "weekly", "monthly"] as const).map((value) => <button key={value} className={schedule === value ? "selected" : ""} onClick={() => setSchedule(value)}>{value === "all" ? "All schedules" : value}</button>)}
      <span />
      <select aria-label="Filter duties by group" value={groupId} onChange={(event) => setGroupId(event.target.value)}>
        <option value="all">All accessible groups</option><option value="home">Whole home</option>
        {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
      </select>
    </div>
    <div className="large-list">{visible.length ? visible.map((duty) => <DutyRow key={duty.id} duty={duty} member={members.get(duty.assigneeId)} group={duty.groupId ? groupById.get(duty.groupId) : undefined} completeDuty={completeDuty} editDuty={editDuty} deleteDuty={deleteDuty} />) : <EmptyState title="No duties match these filters" text="Try another schedule or group." />}</div>
  </div>;
}

function GroupsPage({ groups, members, isPrimary, addSubgroup, deleteGroup }: {
  groups: GroupView[];
  members: Map<string, MemberView>;
  isPrimary: boolean;
  addSubgroup: (parentId: string) => void;
  deleteGroup: (group: GroupView) => void;
}) {
  return <div className="page-panel">
    <div className="access-banner"><span>◎</span><div><strong>Membership-scoped access</strong><p>A subgroup is visible only to its own members. Notifications never go to members outside that group.</p></div></div>
    <div className="group-tree">
      {groups.length ? orderGroups(groups).map(({ group, depth }) => (
        <article className="group-card" key={group.id} style={{ marginLeft: `${Math.min(depth, 3) * 28}px` }}>
          <div className="group-line"><span className="group-icon">{depth ? "↳" : "◎"}</span><div><small>{depth ? "PRIVATE SUBGROUP" : "PRIVATE GROUP"}</small><h3>{group.name}</h3></div><span className="member-count">{group.memberIds.length} members</span></div>
          <div className="group-members">{group.memberIds.map((id) => {
            const member = members.get(id);
            return member ? <span key={id}><i className={`avatar ${member.color}`}>{member.initials}</i>{member.name}</span> : null;
          })}</div>
          {isPrimary && <div className="group-actions"><button onClick={() => addSubgroup(group.id)}>＋ Add subgroup</button><button className="danger" onClick={() => deleteGroup(group)}>Delete group</button></div>}
        </article>
      )) : <EmptyState title="No private groups yet" text="Create a group, choose its members, then add nested subgroups when needed." />}
    </div>
  </div>;
}

function orderGroups(groups: GroupView[]) {
  const output: { group: GroupView; depth: number }[] = [];
  function visit(parentId: string | null, depth: number) {
    groups.filter((group) => group.parentGroupId === parentId).forEach((group) => {
      output.push({ group, depth });
      visit(group.id, depth + 1);
    });
  }
  visit(null, 0);
  return output;
}

function collectGroupIds(groups: GroupView[], rootId: string) {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    groups.forEach((group) => {
      if (group.parentGroupId && ids.has(group.parentGroupId) && !ids.has(group.id)) {
        ids.add(group.id);
        changed = true;
      }
    });
  }
  return ids;
}

function ExpenseRow({ item, settleExpense }: { item: ExpenseView; settleExpense?: (id: string | number) => void }) {
  const status = item.yourShare < 0
    ? `you are owed $${Math.abs(item.yourShare).toFixed(2)}`
    : item.yourShare > 0
      ? `you owe $${item.yourShare.toFixed(2)}`
      : "your share is settled";
  return <article className="expense-row"><div className="expense-icon">▧</div><div><strong>{item.title}</strong><span>{item.paidBy} paid · {item.date}</span></div><div className="expense-amount"><strong>${item.amount.toFixed(2)}</strong><span className={item.yourShare < 0 ? "owed" : item.yourShare > 0 ? "owe" : "settled"}>{status}</span>{settleExpense && item.yourShare > 0 && !item.settled && <button className="settle-button" onClick={() => settleExpense(item.id)}>Mark paid</button>}</div></article>;
}

function ExpensesPage({ expenses, yourBalance, settleExpense }: { expenses: ExpenseView[]; yourBalance: number; settleExpense: (id: string | number) => void }) {
  const owed = expenses.reduce((sum, item) => sum + Math.max(0, -item.yourShare), 0);
  const owe = expenses.reduce((sum, item) => sum + Math.max(0, item.yourShare), 0);
  return <div className="page-panel"><div className="stats-grid"><div><small>YOU ARE OWED</small><strong className="positive">${owed.toFixed(2)}</strong><span>from flatmates</span></div><div><small>YOU OWE</small><strong>${owe.toFixed(2)}</strong><span>across expenses</span></div><div><small>NET BALANCE</small><strong className={yourBalance >= 0 ? "positive" : ""}>{yourBalance >= 0 ? "+" : "−"}${Math.abs(yourBalance).toFixed(2)}</strong><span>overall</span></div></div><section className="full-card"><div className="section-heading"><div><h2>All expenses</h2><p>Shared home ledger</p></div></div>{expenses.map((item) => <ExpenseRow key={item.id} item={item} settleExpense={settleExpense} />)}</section></div>;
}

function MembersPage({ members, removeMember, makePrimary, reinviteMember, currentUserId, isPrimary }: {
  members: MemberView[];
  removeMember: (id: string) => void;
  makePrimary: (id: string) => void;
  reinviteMember: (id: string) => void;
  currentUserId: string;
  isPrimary: boolean;
}) {
  return <div className="page-panel">
    <div className="access-banner"><span>⌂</span><div><strong>Home access</strong><p>Each joined flatmate signs in separately. Removing someone immediately ends their access.</p></div></div>
    <div className="member-grid">{members.map((member) => <article className="member-card" key={member.email}>
      <span className={`member-avatar ${member.color}`}>{member.initials}</span>
      <strong>{member.name}</strong>
      <p>{member.email}</p>
      <span className={`role-badge ${member.role === "Primary" ? "primary" : ""}`}>{member.joined ? member.role : "Invitation pending"}</span>
      <div>
        {member.id === currentUserId
          ? <button disabled>Your account</button>
          : isPrimary && !member.joined
            ? <><button onClick={() => reinviteMember(member.id)}>New invite link</button><button className="danger" onClick={() => removeMember(member.id)}>Cancel invitation</button></>
            : isPrimary && member.role !== "Primary"
              ? <><button onClick={() => makePrimary(member.id)}>Make primary</button><button className="danger" onClick={() => removeMember(member.id)}>Remove access</button></>
              : <button disabled>{member.role === "Primary" ? "Primary access" : "Member access"}</button>}
      </div>
    </article>)}</div>
  </div>;
}

function DutyForm({ duty, members, groups, onSubmit }: {
  duty: Duty | null;
  members: MemberView[];
  groups: GroupView[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [groupId, setGroupId] = useState(duty?.groupId ?? "");
  const selectedGroup = groups.find((group) => group.id === groupId);
  const eligibleMembers = (selectedGroup ? members.filter((member) => selectedGroup.memberIds.includes(member.id)) : members).filter((member) => member.joined);
  const defaultAssignee = eligibleMembers.some((member) => member.id === duty?.assigneeId) ? duty?.assigneeId : eligibleMembers[0]?.id;
  const localDue = new Date(duty?.dueAt ?? sixHours());
  localDue.setMinutes(localDue.getMinutes() - localDue.getTimezoneOffset());
  return <form onSubmit={onSubmit}>
    <span className="modal-icon">✦</span><h2 id="modal-title">{duty ? "Edit duty" : "Create a duty"}</h2>
    <p>Choose who can see the duty and how often it repeats.</p>
    <label>Duty name<input name="title" defaultValue={duty?.title} required placeholder="e.g. Clean the kitchen" /></label>
    <div className="form-grid"><label>Area<select name="area" defaultValue={duty?.area ?? "Kitchen"}><option>Kitchen</option><option>Bathroom</option><option>Living room</option><option>Trash & recycling</option><option>Custom</option></select></label><label>Schedule<select name="recurrence" defaultValue={duty?.recurrence ?? "weekly"}><option value="once">One time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label></div>
    <label>Visible to<select name="groupId" value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">Everyone in this home</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.parentGroupId ? "↳ " : ""}{group.name}</option>)}</select></label>
    <div className="form-grid"><label>Assign to<select name="assigneeId" key={`${groupId}-${defaultAssignee}`} defaultValue={defaultAssignee}>{eligibleMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label>Due date and time<input name="dueAt" type="datetime-local" required defaultValue={localDue.toISOString().slice(0, 16)} /></label></div>
    <p className="privacy-note">🔒 {selectedGroup ? `Only ${selectedGroup.name} members can access this duty and its notifications.` : "All home members can access this duty."}</p>
    <button className="primary-button form-submit">{duty ? "Save changes" : "Create duty"}</button>
  </form>;
}

function GroupForm({ parentId, groups, members, currentUserId, onSubmit }: {
  parentId: string | null;
  groups: GroupView[];
  members: MemberView[];
  currentUserId: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [selectedParentId, setSelectedParentId] = useState(parentId ?? "");
  const parent = groups.find((group) => group.id === selectedParentId);
  const eligibleMembers = (parent ? members.filter((member) => parent.memberIds.includes(member.id)) : members).filter((member) => member.joined);
  return <form onSubmit={onSubmit}>
    <span className="modal-icon">◎</span><h2 id="modal-title">{selectedParentId ? "Create a subgroup" : "Create a private group"}</h2>
    <p>Only selected members will see this group and receive its notifications.</p>
    <label>Group name<input name="name" required placeholder="e.g. Kitchen crew" /></label>
    <label>Inside group<select name="parentGroupId" value={selectedParentId} onChange={(event) => setSelectedParentId(event.target.value)}><option value="">Whole home (top level)</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.parentGroupId ? "↳ " : ""}{group.name}</option>)}</select></label>
    <fieldset className="member-picker"><legend>Members with access</legend>{eligibleMembers.map((member) => <label key={member.id}><input type="checkbox" name="memberIds" value={member.id} defaultChecked={member.id === currentUserId || parent?.memberIds.includes(member.id)} disabled={member.id === currentUserId} /><span className={`avatar ${member.color}`}>{member.initials}</span>{member.name}</label>)}</fieldset>
    <p className="privacy-note">🔒 Subgroup members must already belong to the parent group.</p>
    <button className="primary-button form-submit">Create group</button>
  </form>;
}

function ExpenseForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit}><span className="modal-icon">▧</span><h2 id="modal-title">Add an expense</h2><p>Everyone will see the split right away.</p><label>Description<input name="title" required placeholder="e.g. Weekly groceries" /></label><label>Amount<input name="amount" required min="0.01" step="0.01" type="number" placeholder="$0.00" /></label><button className="primary-button form-submit">Add and split expense</button></form>;
}

function InviteForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit}><span className="modal-icon">♙</span><h2 id="modal-title">Invite a flatmate</h2><p>Create a private link they can use to set their own password.</p><label>Name<input name="name" required minLength={2} placeholder="e.g. Rachel Green" /></label><label>Email address<input name="email" required type="email" placeholder="flatmate@email.com" /></label><button className="primary-button form-submit">Create invitation link</button></form>;
}

function InvitationReady({ inviteUrl, onCopy }: { inviteUrl: string; onCopy: () => void }) {
  return <div className="invitation-ready"><span className="modal-icon">✓</span><h2 id="modal-title">Invitation ready</h2><p>Send this private link to your flatmate. It expires in seven days and can be used once.</p><label>Invitation link<textarea readOnly value={inviteUrl} /></label><button className="primary-button form-submit" onClick={onCopy}>Copy invitation link</button><small>Share it privately—not in a public post or repository.</small></div>;
}

function AuthLoading() {
  return <main className="auth-shell"><section className="auth-card auth-loading"><span className="brand auth-brand"><span className="brand-mark"><i /><i /><i /></span><span>flatmate<span className="brand-dot">.</span></span></span><div className="loading-pulse" /><p>Opening your shared home…</p></section></main>;
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: ApiUser) => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [inviteToken, setInviteToken] = useState("");
  const [inviteInfo, setInviteInfo] = useState<ApiInviteInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite") ?? "";
    if (!token) return;
    // The token exists only in the browser URL and must be copied into client state after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInviteToken(token);
    api<ApiInviteInfo>(`/auth/invitations/${encodeURIComponent(token)}`)
      .then(setInviteInfo)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Invitation could not be opened"));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      let result: { user: ApiUser };
      if (inviteToken) {
        result = await api(`/auth/invitations/${encodeURIComponent(inviteToken)}/accept`, {
          method: "POST",
          body: JSON.stringify({ password: String(data.get("password")) }),
        });
      } else if (mode === "register") {
        result = await api("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            name: String(data.get("name")),
            email: String(data.get("email")),
            password: String(data.get("password")),
            homeName: String(data.get("homeName")),
          }),
        });
      } else {
        result = await api("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: String(data.get("email")), password: String(data.get("password")) }),
        });
      }
      await onAuthenticated(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  async function openDemo() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: ApiUser }>("/auth/demo", { method: "POST" });
      await onAuthenticated(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Demo mode is unavailable");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-shell">
    <section className="auth-story">
      <span className="brand auth-brand"><span className="brand-mark"><i /><i /><i /></span><span>flatmate<span className="brand-dot">.</span></span></span>
      <div><p className="eyebrow">SHARED LIVING, SORTED</p><h1>Less reminding.<br />More living.</h1><p>Duties, expenses, private groups, and the right notification for every flatmate.</p></div>
      <div className="auth-proof"><span>✓</span><p><strong>Private by design</strong><small>Members see only their home and groups.</small></p></div>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        {inviteToken ? <>
          <span className="auth-kicker">YOU’RE INVITED</span>
          <h2>Join {inviteInfo?.homeName ?? "your Flatmate home"}</h2>
          <p>{inviteInfo ? `${inviteInfo.name}, create a password for ${inviteInfo.email}.` : "Checking your secure invitation…"}</p>
          <form onSubmit={submit}>
            <label>Create password<input name="password" type="password" minLength={10} autoComplete="new-password" required placeholder="At least 10 characters" /></label>
            {error && <div className="auth-error">{error}</div>}
            <button className="primary-button auth-submit" disabled={busy || !inviteInfo}>{busy ? "Joining…" : "Join home"}</button>
          </form>
        </> : <>
          <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button><button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create a home</button></div>
          <h2>{mode === "login" ? "Welcome back" : "Start your shared home"}</h2>
          <p>{mode === "login" ? "Use your own Flatmate account." : "You’ll become the primary member and can invite everyone else."}</p>
          <form onSubmit={submit}>
            {mode === "register" && <><label>Your name<input name="name" minLength={2} required placeholder="Monica Geller" /></label><label>Home name<input name="homeName" minLength={2} required placeholder="Maple House" /></label></>}
            <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
            <label>Password<input name="password" type="password" minLength={mode === "register" ? 10 : undefined} autoComplete={mode === "register" ? "new-password" : "current-password"} required placeholder={mode === "register" ? "At least 10 characters" : "Your password"} /></label>
            {error && <div className="auth-error">{error}</div>}
            <button className="primary-button auth-submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create home"}</button>
          </form>
          {mode === "login" && googleEnabled && <a className="google-button" href={apiUrl("/auth/google")}>Continue with Google</a>}
          <div className="auth-divider"><span>or explore the sample home</span></div>
          <button className="demo-button" onClick={openDemo} disabled={busy}>Open Monica’s demo</button>
          <p className="demo-credentials">Every sample member can sign in with their `@example.com` email and password <strong>Flatmate123!</strong></p>
        </>}
      </div>
    </section>
  </main>;
}

function formatRelativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><span>◎</span><strong>{title}</strong><p>{text}</p></div>;
}
