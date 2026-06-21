import { NextResponse, type NextRequest } from "next/server";

const canonicalOrigin = "https://tacomaverifier.net";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase() ?? "";

  if (isLocalHost(host) || !isNetlifyHost(host)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = new URL(canonicalOrigin).host;

  return NextResponse.redirect(url, 301);
}

function isLocalHost(host: string) {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

function isNetlifyHost(host: string) {
  return (
    host === "driveline1.netlify.app" ||
    host.includes("--driveline1.netlify.app") ||
    host.endsWith(".netlify.app")
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"
  ]
};
