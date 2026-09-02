import { redirect } from "next/navigation";
import { getAdminFromCookies } from "@/lib/auth/admin";
import AdminClient from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdminFromCookies();
  if (!admin) {
    redirect("/dashboard");
  }
  return <AdminClient email={admin.email} username={admin.username} />;
}
