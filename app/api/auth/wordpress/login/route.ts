import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const CLIENT_ID = process.env.WORDPRESS_CLIENT_ID;

export async function GET(req: NextRequest) {
  if (!CLIENT_ID) {
    return NextResponse.json({ error: "WordPress Client ID not configured" }, { status: 500 });
  }

  const callbackUrl = `${req.nextUrl.origin}/api/auth/callback/wordpress`;
  const wordpressAuthUrl = `https://public-api.wordpress.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=global`;

  return NextResponse.redirect(wordpressAuthUrl);
}
