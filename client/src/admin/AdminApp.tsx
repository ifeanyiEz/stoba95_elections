import { useEffect, useState } from "react";
import { adminApi, type AdminMember } from "../api";
import RolesPanel from "./RolesPanel";
import MembersPanel from "./MembersPanel";
import "./admin.css";

type Tab = "roles" | "members";

export default function AdminApp() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("roles");
  const [members, setMembers] = useState<AdminMember[]>([]);

  useEffect(() => {
    adminApi
      .roles()
      .then(() => setLoggedIn(true))
      .catch(() => setLoggedIn(false));
  }, []);

  function loadMembers() {
    adminApi.members().then((r) => setMembers(r.members)).catch(() => {});
  }

  useEffect(() => {
    if (loggedIn) loadMembers();
  }, [loggedIn]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await adminApi.login(adminId, password);
      setLoggedIn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  async function handleLogout() {
    await adminApi.logout().catch(() => {});
    setLoggedIn(false);
    setAdminId("");
    setPassword("");
  }

  if (loggedIn === null) {
    return null;
  }

  if (!loggedIn) {
    return (
      <section id="admin-login">
        <img src="/logo.png" alt="STOBA '95 crest" className="crest" />
        <h1>STOBA 95 Admin</h1>
        <form onSubmit={handleLogin}>
          <label>
            Admin ID
            <input value={adminId} onChange={(e) => setAdminId(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button type="submit">Log in</button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  return (
    <div id="admin">
      <header className="app-header">
        <img src="/logo.png" alt="STOBA '95 crest" className="crest crest-small" />
        <h1>STOBA 95 Admin</h1>
        <a className="secondary-link" href="/">
          Voter site
        </a>
        <button type="button" className="logout-btn" onClick={handleLogout}>
          Log out
        </button>
      </header>

      <nav className="admin-tabs">
        <button type="button" className={tab === "roles" ? "active" : "secondary"} onClick={() => setTab("roles")}>
          Roles & nominees
        </button>
        <button
          type="button"
          className={tab === "members" ? "active" : "secondary"}
          onClick={() => setTab("members")}
        >
          Members
        </button>
      </nav>

      {tab === "roles" && <RolesPanel members={members} />}
      {tab === "members" && <MembersPanel onChanged={loadMembers} />}
    </div>
  );
}
