import { useEffect, useState } from "react";
import { adminApi, type AdminMember } from "../api";

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export default function MembersPanel({ onChanged }: { onChanged: () => void }) {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lastIssued, setLastIssued] = useState<{ memberId: string; pin: string } | null>(null);

  const [newMemberId, setNewMemberId] = useState("");
  const [newName, setNewName] = useState("");
  const [newContact, setNewContact] = useState("");

  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  function loadMembers() {
    adminApi
      .members()
      .then((r) => setMembers(r.members))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load members"));
  }

  useEffect(loadMembers, []);

  async function handleToggleEligible(m: AdminMember) {
    setError(null);
    const makingIneligible = m.is_eligible;
    let note: string | null = null;
    if (makingIneligible) {
      note = window.prompt(`Reason ${m.name} is being marked ineligible (optional):`, m.eligibility_note ?? "");
    }
    try {
      await adminApi.setEligibility(m.member_id, !makingIneligible, note ?? undefined);
      loadMembers();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update eligibility");
    }
  }

  async function handleResetPin(memberId: string) {
    setError(null);
    const pin = randomPin();
    try {
      await adminApi.resetPin(memberId, pin);
      setLastIssued({ memberId, pin });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset PIN");
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const pin = randomPin();
    try {
      await adminApi.issueMembers([
        { memberId: newMemberId, name: newName, pin, contact: newContact || undefined },
      ]);
      setLastIssued({ memberId: newMemberId, pin });
      setNewMemberId("");
      setNewName("");
      setNewContact("");
      loadMembers();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    }
  }

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBulkResult(null);
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const parsed = lines.map((line) => {
      const [memberId, name, contact] = line.split(",").map((s) => s.trim());
      return { memberId, name, pin: randomPin(), contact: contact || undefined };
    });
    if (parsed.some((m) => !m.memberId || !m.name)) {
      setError("Each line must be: memberId, name[, contact]");
      return;
    }
    try {
      await adminApi.issueMembers(parsed);
      setBulkResult(
        `Issued ${parsed.length} members. PINs: ` +
          parsed.map((m) => `${m.memberId}=${m.pin}`).join(", ")
      );
      setBulkText("");
      loadMembers();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk import failed");
    }
  }

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.member_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {lastIssued && (
        <p className="notice">
          PIN for {lastIssued.memberId}: <strong>{lastIssued.pin}</strong> — record this now, it cannot be
          shown again.
        </p>
      )}

      <div className="panel-columns">
        <form className="stacked-form" onSubmit={handleAddMember}>
          <h4>Add member</h4>
          <label>
            Member ID
            <input value={newMemberId} onChange={(e) => setNewMemberId(e.target.value)} required />
          </label>
          <label>
            Name
            <input value={newName} onChange={(e) => setNewName(e.target.value)} required />
          </label>
          <label>
            Contact (optional)
            <input value={newContact} onChange={(e) => setNewContact(e.target.value)} />
          </label>
          <button type="submit">Add & generate PIN</button>
        </form>

        <form className="stacked-form" onSubmit={handleBulkImport}>
          <h4>Bulk import</h4>
          <label>
            One per line: memberId, name, contact (optional)
            <textarea
              rows={5}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="STB086, New Member Name"
            />
          </label>
          <button type="submit">Import</button>
          {bulkResult && <p className="notice small">{bulkResult}</p>}
        </form>
      </div>

      <input
        className="search"
        placeholder="Search by name or member ID…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <table className="admin-table">
        <thead>
          <tr>
            <th>Member ID</th>
            <th>Name</th>
            <th>Eligible</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((m) => (
            <tr key={m.member_id}>
              <td>{m.member_id}</td>
              <td>{m.name}</td>
              <td>
                {m.is_eligible ? (
                  <span className="badge badge-open">eligible</span>
                ) : (
                  <span className="badge badge-danger" title={m.eligibility_note ?? undefined}>
                    ineligible
                  </span>
                )}
              </td>
              <td className="actions">
                <button type="button" className="secondary" onClick={() => handleToggleEligible(m)}>
                  {m.is_eligible ? "Mark ineligible" : "Mark eligible"}
                </button>
                <button type="button" className="secondary" onClick={() => handleResetPin(m.member_id)}>
                  Reset PIN
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
