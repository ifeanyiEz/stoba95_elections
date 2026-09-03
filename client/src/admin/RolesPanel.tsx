import { Fragment, useEffect, useState } from "react";
import { adminApi, type AdminRole, type AdminNominee, type AdminMember, type RoleResults } from "../api";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function RolesPanel({ members }: { members: AdminMember[] }) {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [nominees, setNominees] = useState<Record<number, AdminNominee[]>>({});
  const [results, setResults] = useState<Record<number, RoleResults>>({});
  const [newNomineeId, setNewNomineeId] = useState("");
  const [closesAtDraft, setClosesAtDraft] = useState<Record<number, string>>({});

  function loadRoles() {
    adminApi
      .roles()
      .then((r) => setRoles(r.roles))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load roles"));
  }

  useEffect(loadRoles, []);

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await adminApi.createRole(newTitle);
      setNewTitle("");
      loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create role");
    }
  }

  async function handleOpen(roleId: number) {
    setError(null);
    const draft = closesAtDraft[roleId];
    const closesAt = draft ? new Date(draft).toISOString() : null;
    try {
      await adminApi.openRole(roleId, closesAt);
      loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open role");
    }
  }

  async function handleClose(roleId: number) {
    setError(null);
    try {
      await adminApi.closeRole(roleId);
      loadRoles();
      if (expanded === roleId) loadResults(roleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close role");
    }
  }

  function loadNominees(roleId: number) {
    adminApi.nominees(roleId).then((r) => setNominees((prev) => ({ ...prev, [roleId]: r.nominees })));
  }

  function loadResults(roleId: number) {
    adminApi
      .roleResults(roleId)
      .then((r) => setResults((prev) => ({ ...prev, [roleId]: r })))
      .catch(() => {});
  }

  function toggleExpand(role: AdminRole) {
    if (expanded === role.role_id) {
      setExpanded(null);
      return;
    }
    setExpanded(role.role_id);
    loadNominees(role.role_id);
    if (!role.is_open) loadResults(role.role_id);
  }

  async function handleAddNominee(roleId: number) {
    if (!newNomineeId) return;
    setError(null);
    try {
      await adminApi.addNominee(roleId, newNomineeId);
      setNewNomineeId("");
      loadNominees(roleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add nominee");
    }
  }

  async function handleRemoveNominee(roleId: number, nomineeId: number) {
    setError(null);
    try {
      await adminApi.removeNominee(roleId, nomineeId);
      loadNominees(roleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove nominee");
    }
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}

      <form className="inline-form" onSubmit={handleCreateRole}>
        <input placeholder="New role title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
        <button type="submit">Add role</button>
      </form>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Role</th>
            <th>Status</th>
            <th>Scheduled close</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <Fragment key={role.role_id}>
              <tr>
                <td>{role.title}</td>
                <td>
                  {role.is_open ? (
                    <span className="badge badge-open">open</span>
                  ) : (
                    <span className="badge">closed</span>
                  )}
                </td>
                <td>
                  {role.is_open ? (
                    <input
                      type="datetime-local"
                      aria-label={`Scheduled close time for ${role.title}`}
                      value={closesAtDraft[role.role_id] ?? toLocalInputValue(role.closes_at)}
                      onChange={(e) =>
                        setClosesAtDraft((prev) => ({ ...prev, [role.role_id]: e.target.value }))
                      }
                    />
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="actions">
                  {role.is_open ? (
                    <button type="button" onClick={() => handleClose(role.role_id)}>
                      Close now
                    </button>
                  ) : (
                    <button type="button" onClick={() => handleOpen(role.role_id)}>
                      Open
                    </button>
                  )}
                  <button type="button" className="secondary" onClick={() => toggleExpand(role)}>
                    {expanded === role.role_id ? "Hide" : "Manage"}
                  </button>
                </td>
              </tr>
              {expanded === role.role_id && (
                <tr>
                  <td colSpan={4}>
                    <div className="role-detail">
                      <h4>Nominees</h4>
                      <ul className="nominee-list">
                        {(nominees[role.role_id] ?? []).map((n) => (
                          <li key={n.nominee_id}>
                            <span>
                              {n.name} <span className="muted">({n.member_id})</span>
                            </span>
                            <button
                              type="button"
                              className="secondary danger-text"
                              onClick={() => handleRemoveNominee(role.role_id, n.nominee_id)}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                        {(nominees[role.role_id] ?? []).length === 0 && <li className="muted">No nominees yet.</li>}
                      </ul>
                      <div className="inline-form">
                        <select
                          aria-label={`Add nominee to ${role.title}`}
                          value={newNomineeId}
                          onChange={(e) => setNewNomineeId(e.target.value)}
                        >
                          <option value="">Select member…</option>
                          {members.map((m) => (
                            <option key={m.member_id} value={m.member_id}>
                              {m.name} ({m.member_id})
                            </option>
                          ))}
                        </select>
                        <button type="button" onClick={() => handleAddNominee(role.role_id)}>
                          Add nominee
                        </button>
                      </div>

                      {!role.is_open && (
                        <>
                          <h4>Results</h4>
                          {results[role.role_id] ? (
                            <ul className="nominee-list">
                              {results[role.role_id].results
                                .slice()
                                .sort((a, b) => b.votes - a.votes)
                                .map((r) => (
                                  <li key={r.nomineeId}>
                                    <span>{r.name}</span>
                                    <span>{r.votes} votes</span>
                                  </li>
                                ))}
                            </ul>
                          ) : (
                            <p className="muted">Loading…</p>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
