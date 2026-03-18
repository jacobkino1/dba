import Header from "./Header";
import Sidebar from "./Sidebar";
import MainPanel from "./MainPanel";


export default function AppShell() {
  return (
    <div style={styles.app}>
      <Header />


      <div style={styles.body}>
        <Sidebar />
        <MainPanel />
      </div>
    </div>
  );
}


const styles = {
  app: {
    height: "100vh",
    width: "100vw",
    background: "#020617",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  body: {
    flex: 1,
    display: "flex",
    width: "100%",
    minWidth: 0,
    minHeight: 0,
  },
};

