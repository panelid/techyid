"use client";

import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import BottomNav from "@/components/BottomNav";

export default function DashboardSettingsPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <main style={{ minHeight: "100vh", background: "#F5F5F0", paddingBottom: 80 }}>
      <div style={{ background: "#BEEE11", borderBottom: "3px solid #000", padding: "14px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => router.push("/dashboard")} style={{ border: "2px solid #000", padding: "6px 14px", fontWeight: 800, fontSize: 13, background: "#fff", cursor: "pointer", boxShadow: "3px 3px 0 #000" }}>← Dashboard</button>
          <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>⚙️ Settings</h1>
          <div style={{ width: 90 }}></div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ background: "#fff", border: "3px solid #000", boxShadow: "5px 5px 0 #000", padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 900, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
            <User size={18} /> Akun
          </h2>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 20 }}>
            <p>Pengaturan akun dan preferensi email sedang dalam pengembangan.</p>
          </div>
          <button
            onClick={handleLogout}
            style={{ width: "100%", padding: 12, background: "#fff", border: "2px solid #f00", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "3px 3px 0 #f00", color: "#c00" }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      <BottomNav active="settings" />
    </main>
  );
}