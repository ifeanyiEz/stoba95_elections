import { useEffect, useState } from "react";
import { api } from "./api";
import "./App.css";

type Ballot = Awaited<ReturnType<typeof api.ballot>>["roles"];
type Turnout = Awaited<ReturnType<typeof api.turnout>>["roles"];
type Results = Awaited<ReturnType<typeof api.results>>["roles"];

function VoterApp() {
  const [memberId, setMemberId] = useState("");
  const [pin, setPin] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ballot, setBallot] = useState<Ballot>([]);
  const [turnout, setTurnout] = useState<Turnout>([]);
  const [results, setResults] = useState<Results>([]);
  const [ineligible, setIneligible] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(() => setLoggedIn(true))
      .catch(() => setLoggedIn(false));
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    refresh();
    const interval = setInterval(() => {
      api.turnout().then((r) => setTurnout(r.roles));
      api.results().then((r) => setResults(r.roles));
    }, 4000);
    return () => clearInterval(interval);
  }, [loggedIn]);

  function refresh() {
    api
      .ballot()
      .then((r) => {
        setBallot(r.roles);
        setIneligible(false);
      })
      .catch((err) => {
        setBallot([]);
        setIneligible(err instanceof Error && err.message.includes("not eligible"));
      });
    api.turnout().then((r) => setTurnout(r.roles));
    api.results().then((r) => setResults(r.roles));
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.login(memberId, pin);
      setLoggedIn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  async function handleLogout() {
    await api.logout().catch(() => {});
    setLoggedIn(false);
    setMemberId("");
    setPin("");
    setBallot([]);
    setTurnout([]);
    setResults([]);
    setError(null);
  }

  async function handleVote(roleId: number, nomineeId: number) {
    setError(null);
    try {
      await api.castVote(roleId, nomineeId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vote failed");
    }
  }

  if (!loggedIn) {
    return (
      <section id="login">
        <img src="/logo.png" alt="STOBA '95 crest" className="crest" />
        <h1>STOBA 95 Elections</h1>
        <form onSubmit={handleLogin}>
          <label>
            Member ID
            <input value={memberId} onChange={(e) => setMemberId(e.target.value)} required />
          </label>
          <label>
            PIN
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} required />
          </label>
          <button type="submit">Log in</button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  return (
    <div id="voting">
      <header className="app-header">
        <img src="/logo.png" alt="STOBA '95 crest" className="crest crest-small" />
        <h1>STOBA 95 Elections</h1>
        <button type="button" className="logout-btn" onClick={handleLogout}>
          Log out
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      <section>
        <h2>Ballot</h2>
        {ineligible && <p className="muted">You are not eligible to vote in this election.</p>}
        {!ineligible && ballot.length === 0 && <p className="muted">No open roles left for you to vote on.</p>}
        {ballot.map((role) => (
          <div key={role.role_id} className="role">
            <h3>{role.title}</h3>
            <ul>
              {role.nominees.map((n) => (
                <li key={n.nominee_id}>
                  <span>{n.name}</span>
                  <button onClick={() => handleVote(role.role_id, n.nominee_id)}>Vote</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section>
        <h2>Live turnout</h2>
        <ul className="turnout-list">
          {turnout.map((r) => (
            <li key={r.roleId}>
              <span>{r.title}</span>
              <span>
                {r.votedCount} of {r.totalMembers} voted
                {!r.isOpen && <span className="badge">closed</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {results.length > 0 && (
        <section>
          <h2>Results</h2>
          {results.map((role) => {
            const maxVotes = Math.max(...role.results.map((r) => r.votes), 0);
            return (
              <div key={role.roleId} className="role results-role">
                <h3>{role.title}</h3>
                <ul>
                  {role.results.map((r) => (
                    <li key={r.nomineeId} className={r.votes === maxVotes && maxVotes > 0 ? "winner" : ""}>
                      <span>{r.name}</span>
                      <span>{r.votes} votes</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

export default VoterApp;
