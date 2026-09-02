// src/middleware/index.ts
// Custom domain routing middleware

import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  
  // Skip middleware for static assets, API, and main domains
  const isCustomDomain = hostname && 
    !hostname.includes("vercel.app") &&
    !hostname.endsWith("door.id") &&
    hostname !== "localhost";
  
  if (!isCustomDomain) {
    return NextResponse.next();
  }

  // Extract slug from path
  const pathname = request.nextUrl.pathname;
  const slug = pathname.slice(1);
  
  if (!slug || slug.startsWith("_next") || slug.startsWith("api")) {
    // Pass custom domain header to downstream handler
    const response = NextResponse.next();
    response.headers.set("x-door-custom-domain", hostname);
    return response;
  }

  // Pass custom domain header to downstream handler
  const response = NextResponse.next();
  response.headers.set("x-door-custom-domain", hostname);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};