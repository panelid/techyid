import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ authenticated: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ 
      authenticated: true, 
      user: { 
        userId: user.userId, 
        email: user.email, 
        username: user.username,
        isAdmin: !!(user as any).isAdmin
      } 
    });
  } catch (error: any) {
    console.error("[API:auth/session:GET]", error);
    return NextResponse.json({ error: "Terjadi kesalahan, coba lagi" }, { status: 500 });
  }
}
