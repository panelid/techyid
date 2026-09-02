import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/auth/session';
import { getDB } from '@/lib/db';
import DashboardClient from '@/components/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getSessionFromCookies();
  if (!user) {
    redirect('/login');
  }

  let isAdmin = false;
  try {
    const db = getDB();
    if (db) {
      const row = await db
        .prepare("SELECT is_admin FROM users WHERE id = ? LIMIT 1")
        .bind(user.userId)
        .first();
      isAdmin = !!(row as any)?.is_admin;
    }
  } catch {
    isAdmin = false;
  }

  return <DashboardClient user={user} isAdmin={isAdmin} />;
}
