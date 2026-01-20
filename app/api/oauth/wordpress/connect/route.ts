import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const CLIENT_ID = process.env.WORDPRESS_CLIENT_ID;

export async function GET(req: NextRequest) {
  if (!CLIENT_ID) {
    return NextResponse.json({ error: "Missing WORDPRESS_CLIENT_ID" }, { status: 500 });
  }

  // Build the callback URL based on the current origin
  const callbackUrl = `${req.nextUrl.origin}/api/auth/callback/wordpress`;

  const targetUrl = new URL("https://public-api.wordpress.com/oauth2/authorize");
  targetUrl.searchParams.set("client_id", CLIENT_ID);
  targetUrl.searchParams.set("redirect_uri", callbackUrl);
  targetUrl.searchParams.set("response_type", "code");
  targetUrl.searchParams.set("scope", "global");

  return NextResponse.redirect(targetUrl);
}
