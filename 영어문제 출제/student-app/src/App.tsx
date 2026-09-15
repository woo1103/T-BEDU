import { useState } from "react";
import { getStudent, clearSession, type Student } from "./lib/api";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";

export default function App() {
  const [student, setStudent] = useState<Student | null>(getStudent());
  const [mode, setMode] = useState<"login" | "register">("login");

  if (student) {
    return (
      <Home
        student={student}
        onLogout={() => {
          clearSession();
          setStudent(null);
          setMode("login");
        }}
      />
    );
  }

  return mode === "login" ? (
    <Login onSuccess={setStudent} goRegister={() => setMode("register")} />
  ) : (
    <Register onSuccess={setStudent} goLogin={() => setMode("login")} />
  );
}
