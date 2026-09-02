import { NextResponse } from "next/server";

export async function middleware(request: Request) {
  const url = new URL(request.url);
  const hostname = url.hostname;
  
  // Skip for main domains and static
  const exclude = ["localhost", "techy.id", "techy.id"];
  if (exclude.includes(hostname) || hostname.endsWith(".vercel.app")) {
    return NextResponse.next();
  }

  // Custom domain routing
  const response = NextResponse.next();
  response.headers.set("x-techy-custom-domain", hostname);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};