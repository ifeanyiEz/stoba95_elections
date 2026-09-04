// Empty by default so production (single-service, same-origin) requests are
// relative. Local dev sets VITE_API_URL to point at the separate API port.
const API_URL = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return body as T;
}

export const api = {
  login: (memberId: string, pin: string) =>
    request<{ ok: true; memberId: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ memberId, pin }),
    }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => request<{ memberId: string }>("/auth/me"),

  ballot: () =>
    request<{ roles: { role_id: number; title: string; nominees: { nominee_id: number; name: string }[] }[] }>(
      "/votes/ballot"
    ),
  castVote: (roleId: number, nomineeId: number) =>
    request<{ ok: true }>("/votes", {
      method: "POST",
      body: JSON.stringify({ roleId, nomineeId }),
    }),

  turnout: () =>
    request<{ roles: { roleId: number; title: string; isOpen: boolean; totalMembers: number; votedCount: number }[] }>(
      "/turnout"
    ),

  results: () =>
    request<{
      roles: {
        roleId: number;
        title: string;
        closedAt: string;
        results: { nomineeId: number; name: string; votes: number }[];
      }[];
    }>("/results"),
};

export interface AdminRole {
  role_id: number;
  title: string;
  is_open: boolean;
  closes_at: string | null;
  closed_at: string | null;
}

export interface AdminNominee {
  nominee_id: number;
  member_id: string;
  name: string;
}

export interface AdminMember {
  member_id: string;
  name: string;
  contact: string | null;
  is_eligible: boolean;
  eligibility_note: string | null;
}

export interface RoleResults {
  roleId: number;
  title: string;
  results: { nomineeId: number; name: string; votes: number }[];
}

export const adminApi = {
  login: (adminId: string, password: string) =>
    request<{ ok: true; adminId: string }>("/auth/admin/login", {
      method: "POST",
      body: JSON.stringify({ adminId, password }),
    }),
  logout: () => request<{ ok: true }>("/auth/admin/logout", { method: "POST" }),

  roles: () => request<{ roles: AdminRole[] }>("/admin/roles"),
  createRole: (title: string) =>
    request<{ role: AdminRole }>("/admin/roles", { method: "POST", body: JSON.stringify({ title }) }),
  openRole: (roleId: number, closesAt?: string | null) =>
    request<{ role: AdminRole }>(`/admin/roles/${roleId}/open`, {
      method: "POST",
      body: JSON.stringify({ closesAt: closesAt ?? null }),
    }),
  closeRole: (roleId: number) =>
    request<{ role: AdminRole }>(`/admin/roles/${roleId}/close`, { method: "POST" }),
  roleResults: (roleId: number) => request<RoleResults>(`/admin/roles/${roleId}/results`),

  nominees: (roleId: number) => request<{ nominees: AdminNominee[] }>(`/admin/roles/${roleId}/nominees`),
  addNominee: (roleId: number, memberId: string) =>
    request<{ nominee: AdminNominee }>(`/admin/roles/${roleId}/nominees`, {
      method: "POST",
      body: JSON.stringify({ memberId }),
    }),
  removeNominee: (roleId: number, nomineeId: number) =>
    request<{ ok: true }>(`/admin/roles/${roleId}/nominees/${nomineeId}`, { method: "DELETE" }),

  members: () => request<{ members: AdminMember[] }>("/admin/members"),
  issueMembers: (
    members: { memberId: string; name: string; pin: string; contact?: string; isEligible?: boolean }[]
  ) => request<{ ok: true; count: number }>("/admin/members/issue", { method: "POST", body: JSON.stringify({ members }) }),
  setEligibility: (memberId: string, isEligible: boolean, note?: string) =>
    request<{ member: AdminMember }>(`/admin/members/${memberId}/eligibility`, {
      method: "POST",
      body: JSON.stringify({ isEligible, note: note ?? null }),
    }),
  resetPin: (memberId: string, pin: string) =>
    request<{ ok: true }>(`/admin/members/${memberId}/reset-pin`, {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>("/admin/account/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};
