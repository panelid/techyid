"use client";

import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import BottomNav from "@/components/BottomNav";

export default function DashboardAgentsPage() {
  const router = useRouter();

  return (
    <main style={{ minHeight: "100vh", background: "#F5F5F0", paddingBottom: 80 }}>
      <div style={{ background: "#BEEE11", borderBottom: "3px solid #000", padding: "14px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => router.push("/dashboard")} style={{ border: "2px solid #000", padding: "6px 14px", fontWeight: 800, fontSize: 13, background: "#fff", cursor: "pointer", boxShadow: "3px 3px 0 #000" }}>← Dashboard</button>
          <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>🤖 Agents</h1>
          <div style={{ width: 90 }}></div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ background: "#fff", border: "3px solid #000", boxShadow: "5px 5px 0 #000", padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px" }}>AI Agents</h2>
          <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6, marginBottom: 8 }}>
            Fitur AI Agents sedang dalam pengembangan.
          </p>
          <p style={{ fontSize: 12.5, color: "#999", lineHeight: 1.6 }}>
            Nanti kamu bisa menghubungkan agent AI ke link &amp; email door.id kamu.
          </p>
        </div>
      </div>

      <BottomNav active="agents" />
    </main>
  );
}