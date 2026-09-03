import VoterApp from "./VoterApp";
import AdminApp from "./admin/AdminApp";

function App() {
  const isAdmin = window.location.pathname.startsWith("/admin");
  return isAdmin ? <AdminApp /> : <VoterApp />;
}

export default App;
