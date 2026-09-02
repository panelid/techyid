"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart2, Bot, Globe, Mail, Settings, Shield } from "lucide-react";

export type BottomNavActive = "stat" | "email" | "domains" | "agents" | "settings" | "admin";

const navStyle = {
  bottomNav: {
    position: "fixed" as const,
    bottom: 0,
    left: 0,
    right: 0,
    display: "flex",
    background: "#fff",
    borderTop: "4px solid #000",
    zIndex: 200,
    maxWidth: 900,
    margin: "0 auto",
  },
  navItem: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "7px 2px 6px",
    fontSize: "9.5px",
    fontWeight: 700,
    color: "#888",
    cursor: "pointer",
    borderRight: "2.5px solid #000",
    gap: "4px",
    background: "transparent",
    fontFamily: "'Space Grotesk', sans-serif",
    borderTop: "none",
    borderBottom: "none",
    borderLeft: "none",
  } as React.CSSProperties,
  navItemActive: {
    color: "#000",
    background: "#d4ff00",
  },
  navItemLast: {
    borderRight: "none",
  },
};

export default function BottomNav({ active, isAdmin }: { active: BottomNavActive; isAdmin?: boolean }) {
  const [detectedAdmin, setDetectedAdmin] = useState<boolean>(!!isAdmin);
  useEffect(() => {
    if (isAdmin) return;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.user?.isAdmin) setDetectedAdmin(true); })
      .catch(() => {});
  }, []);
  const showAdmin = isAdmin || detectedAdmin;
  const router = useRouter();

  const items: { key: BottomNavActive; label: string; icon: React.ReactNode; target: string }[] = [
    { key: "stat", label: "Statistik", icon: <BarChart2 size={17} />, target: "/dashboard" },
    { key: "agents", label: "Agents", icon: <Bot size={17} />, target: "/dashboard/agents" },
    { key: "email", label: "Email", icon: <Mail size={17} />, target: "/dashboard/email" },
    { key: "domains", label: "Domains", icon: <Globe size={17} />, target: "/dashboard/domains" },
    { key: "settings", label: "Settings", icon: <Settings size={17} />, target: "/dashboard/settings" },
  ];
  if (showAdmin) {
    items.push({ key: "admin", label: "Admin", icon: <Shield size={17} />, target: "/admin" });
  }

  return (
    <nav style={navStyle.bottomNav}>
      {items.map((item, i) => (
        <div
          key={item.key}
          onClick={() => router.push(item.target)}
          style={{
            ...navStyle.navItem,
            ...(i === items.length - 1 ? navStyle.navItemLast : {}),
            ...(active === item.key ? navStyle.navItemActive : {}),
          }}
        >
          {item.icon}
          {item.label}
        </div>
      ))}
    </nav>
  );
}
