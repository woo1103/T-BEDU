import { useState } from "react";
import { getStudent, clearSession, type Student } from "./lib/api";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Solve from "./pages/Solve";
import WrongNotes from "./pages/WrongNotes";
import Videos from "./pages/Videos";
import Notifications from "./pages/Notifications";
import InstallPrompt from "./components/InstallPrompt";

type View =
  | { name: "home" }
  | { name: "solve"; assignmentId: string; title: string }
  | { name: "wrongnotes" }
  | { name: "videos" }
  | { name: "notifications" };

export default function App() {
  const [student, setStudent] = useState<Student | null>(getStudent());
  const [mode, setMode] = useState<"login" | "register">("login");
  const [view, setView] = useState<View>({ name: "home" });

  if (!student) {
    return mode === "login" ? (
      <Login onSuccess={setStudent} goRegister={() => setMode("register")} />
    ) : (
      <Register onSuccess={setStudent} goLogin={() => setMode("login")} />
    );
  }

  if (view.name === "solve") {
    return (
      <Solve
        assignmentId={view.assignmentId}
        title={view.title}
        onDone={() => setView({ name: "home" })}
      />
    );
  }

  if (view.name === "wrongnotes") {
    return <WrongNotes onDone={() => setView({ name: "home" })} />;
  }

  if (view.name === "videos") {
    return <Videos onDone={() => setView({ name: "home" })} />;
  }

  if (view.name === "notifications") {
    return <Notifications onDone={() => setView({ name: "home" })} />;
  }

  return (
    <>
      <InstallPrompt />
      <Home
        student={student}
        onLogout={() => {
          clearSession();
          setStudent(null);
          setMode("login");
          setView({ name: "home" });
        }}
        onSolve={(assignmentId, title) =>
          setView({ name: "solve", assignmentId, title })
        }
        onWrongNotes={() => setView({ name: "wrongnotes" })}
        onVideos={() => setView({ name: "videos" })}
        onNotifications={() => setView({ name: "notifications" })}
      />
    </>
  );
}
