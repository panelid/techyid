import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/auth/session';
import CustomDomainManager from '@/components/custom-domain-manager';
import BottomNav from '@/components/BottomNav';

export const dynamic = 'force-dynamic';

export default async function DashboardDomainsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  return (
    <main style={{ minHeight: '100vh', background: '#f5f0e8', backgroundImage: 'radial-gradient(#00000012 1px, transparent 1px)', backgroundSize: '16px 16px', fontFamily: "'Space Grotesk', sans-serif", paddingBottom: 80 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 16px 60px' }}>
        <a href="/dashboard" style={{ fontSize: 12.5, fontWeight: 800, color: '#000', textDecoration: 'underline' }}>← Dashboard</a>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', margin: '14px 0 4px' }}>Custom Domain</h1>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: '#555', marginBottom: 22 }}>
          Pakai domain sendiri untuk short link kamu + email forwarding gratis.
        </p>
        <CustomDomainManager />
      </div>
      <BottomNav active="domains" />
    </main>
  );
}
