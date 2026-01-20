import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { integrationAccounts, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = 'force-dynamic';

const CLIENT_ID = process.env.WORDPRESS_CLIENT_ID;
const CLIENT_SECRET = process.env.WORDPRESS_CLIENT_SECRET;

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
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

  const callbackUrl = `${req.nextUrl.origin}/api/auth/callback/wordpress`;

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

    // Get internal user ID using regular query instead of db.query
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkUserId));

    if (!user) {
       return NextResponse.redirect(new URL("/documents?error=user_not_found", req.url));
    }

    // Fetch user profile to get username
    let wpUsername = "oauth-user";
    try {
       const meRes = await fetch("https://public-api.wordpress.com/rest/v1.1/me", {
         headers: { Authorization: `Bearer ${access_token}` },
       });
       if (meRes.ok) {
         const meData = await meRes.json();
         if (meData.username) {
           wpUsername = meData.username;
         }
       }
    } catch (e) {
      console.error("Failed to fetch WordPress user profile", e);
    }

    // Determine sites to add
    type SiteInfo = { ID: number; URL: string; name: string };
    const sitesToAdd: SiteInfo[] = [];

    // Helper to fetch site info
    const fetchSiteInfo = async (siteId: number | string) => {
       try {
          const siteRes = await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/${siteId}`, {
             headers: { Authorization: `Bearer ${access_token}` },
          });
          if (siteRes.ok) {
            return await siteRes.json();
          }
       } catch (e) {
          console.error(`Failed to fetch site info for ${siteId}`, e);
       }
       return null;
    };

    if (blog_id) {
       // Single site authorized (even if blog_url is missing in token response, we trust blog_id)
       let siteUrl = blog_url;
       let displayName = blog_url ? `WordPress Site (${blog_url})` : "WordPress Site";
       
       const siteData = await fetchSiteInfo(blog_id);
       if (siteData) {
          if (siteData.URL) siteUrl = siteData.URL;
          if (siteData.name) displayName = siteData.name;
       }

       if (siteUrl) {
          sitesToAdd.push({ ID: blog_id, URL: siteUrl, name: displayName });
       }
    } 
    
    // If no site added yet (or global auth), fetch all sites
    if (sitesToAdd.length === 0) {
       try {
         const sitesRes = await fetch("https://public-api.wordpress.com/rest/v1.1/me/sites", {
           headers: { Authorization: `Bearer ${access_token}` },
         });
         if (sitesRes.ok) {
           const sitesData = await sitesRes.json();
           if (sitesData.sites && Array.isArray(sitesData.sites)) {
              sitesData.sites.forEach((s: { ID: number; URL: string; name: string }) => {
                if (s.URL) {
                    sitesToAdd.push({
                      ID: s.ID,
                      URL: s.URL,
                      name: s.name || `WordPress Site (${s.URL})`
                    });
                }
              });
            }
         }
       } catch (e) {
         console.error("Failed to fetch sites list", e);
       }
    }

    if (sitesToAdd.length === 0) {
       console.warn("No WordPress sites found for user", wpUsername);
       return NextResponse.redirect(new URL("/documents?error=wordpress_no_sites_found", req.url));
    }


    // Save to DB
    for (const site of sitesToAdd) {
      // Check if site already exists for this user
      const [existingSite] = await db
        .select()
        .from(integrationAccounts)
        .where(
          and(
            eq(integrationAccounts.ownerId, user.id),
            eq(integrationAccounts.platform, "wordpress"),
            // We use siteUrl as a unique identifier for now, as blogId is inside JSONB credential
            eq(integrationAccounts.siteUrl, site.URL)
          )
        );

      if (existingSite) {
         // Update existing site
         await db.update(integrationAccounts).set({
            displayName: site.name,
            authType: "oauth",
            identifier: wpUsername,
            credentials: {
                authType: "oauth",
                accessToken: access_token,
                blogId: site.ID,
                ...tokenData
            },
            updatedAt: new Date(),
         }).where(eq(integrationAccounts.id, existingSite.id));
      } else {
         // Insert new site
         await db.insert(integrationAccounts).values({
           ownerId: user.id,
           platform: "wordpress",
           siteUrl: site.URL,
           displayName: site.name,
           authType: "oauth",
           identifier: wpUsername,
           credentials: {
               authType: "oauth",
               accessToken: access_token,
               blogId: site.ID,
               ...tokenData
           }
         });
      }
    }

    return NextResponse.redirect(new URL("/documents?success=wordpress_bound", req.url));

  } catch (err) {
    console.error("OAuth Callback Error", err);
    return NextResponse.redirect(new URL("/documents?error=wordpress_callback_exception", req.url));
  }
}
