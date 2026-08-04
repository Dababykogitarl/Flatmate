const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function apiUrl(path: string) { return `${API_URL}${path}`; }

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init, credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" })) as { message?: string | string[] };
    const message = Array.isArray(error.message) ? error.message.join(", ") : error.message;
    throw new Error(message ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type ApiUser = { sub: string; homeId: string; homeName: string; role: "primary" | "member"; email: string; name: string };
export type ApiMember = { id: string; name: string; email: string; role: "primary" | "member"; homeId: string; joinedAt: string | null; inviteExpiresAt: string | null };
export type ApiInvitation = ApiMember & { inviteUrl: string; emailDelivery: "sent" | "manual" | "failed" };
export type ApiInviteInfo = { name: string; email: string; homeName: string; expiresAt: string };
export type ApiNotification = { id: string; type: string; title: string; message: string; readAt: string | null; createdAt: string };
export type ApiDuty = { id: string; title: string; area: string; assigneeId: string; dueAt: string; completed: boolean; completedAt: string | null; recurrence: string | null; groupId: string | null };
export type ApiGroup = { id: string; name: string; parentGroupId: string | null; memberIds: string[] };
export type ApiExpense = { id: string; title: string; paidById: string; amount: string | number; createdAt: string; splits: { memberId: string; amount: number; settled: boolean }[] };
