import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { wordpressSites, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = 'force-dynamic';

const CLIENT_ID = process.env.WORDPRESS_CLIENT_ID;
const CLIENT_SECRET = process.env.WORDPRESS_CLIENT_SECRET;

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = auth();
  if (!clerkUserId) {
     const signInUrl = new URL("/sign-in", req.url);
     signInUrl.searchParams.set("redirect_url", req.url);
     return NextResponse.redirect(signInUrl);
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/documents?error=wordpress_oauth_error&message=${error}`, req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/documents?error=wordpress_oauth_no_code", req.url));
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
     return NextResponse.redirect(new URL("/documents?error=wordpress_oauth_config_missing", req.url));
  }

  const callbackUrl = `${req.nextUrl.origin}/api/oauth/wordpress/callback`;

  try {
    const tokenRes = await fetch("https://public-api.wordpress.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: callbackUrl,
        code: code,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
       console.error("WordPress OAuth Token Error", tokenData);
       return NextResponse.redirect(new URL("/documents?error=wordpress_token_failed", req.url));
    }

    const { access_token, blog_id, blog_url } = tokenData;

    // Get internal user ID
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkUserId),
    });

    if (!user) {
       return NextResponse.redirect(new URL("/documents?error=user_not_found", req.url));
    }

    // Save to DB
    await db.insert(wordpressSites).values({
      ownerId: user.id,
      siteUrl: blog_url || "https://wordpress.com",
      displayName: blog_url ? `WordPress Site (${blog_url})` : "WordPress.com Site",
      authType: "oauth",
      username: "oauth-user",
      credential: {
          authType: "oauth",
          accessToken: access_token,
          blogId: blog_id,
          ...tokenData
      }
    });

    return NextResponse.redirect(new URL("/documents?success=wordpress_bound", req.url));

  } catch (err) {
    console.error("OAuth Callback Error", err);
    return NextResponse.redirect(new URL("/documents?error=wordpress_callback_exception", req.url));
  }
}
