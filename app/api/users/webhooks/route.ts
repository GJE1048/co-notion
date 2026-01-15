import { db } from "@/db";
import { users } from "@/db/schema";

import { Webhook } from 'svix'
import { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from 'next/headers'
import { eq } from "drizzle-orm";

export async function POST(req:Request) {
    const SIGNING_SECRET = process.env.CLERK_SIGNING_SECRET
    if (!SIGNING_SECRET) {
        throw new Error('Error: Please add CLERK_SIGNING_SECRET from Clerk Dashboard to .env or .env.local')
    }
    // Create new Svix instance with secret
    const wh = new Webhook(SIGNING_SECRET)

    // Get headers
    const headerPayload = await headers()
    const svix_id = headerPayload.get('svix-id')
    const svix_timestamp = headerPayload.get('svix-timestamp')
    const svix_signature = headerPayload.get('svix-signature')

      // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
        return new Response('Error: Missing Svix headers', {
        status: 400,
        })
    }

    //Get body
    const payload = await req.json()
    const body = JSON.stringify(payload);

    let evt : WebhookEvent

    //Verify payload with headers
    try{
        evt = wh.verify(body,{
            'svix-id': svix_id,
            'svix-timestamp': svix_timestamp,
            'svix-signature': svix_signature,
        }) as WebhookEvent
    } catch (err){
        console.error('Error: Could not verify webhook:', err)
        return new Response('Error: Verification error', {
            status: 400,
        })
    }

      // Do something with payload
     // For this guide, log payload to console

    const eventType = evt.type
    if(eventType === "user.created"){
        const { data } = evt

        // 生成唯一的用户名：优先使用 username，否则使用 email 前缀，最后使用 clerkId
        const username = data.username
            || data.email_addresses?.[0]?.email_address?.split('@')[0]
            || `user_${data.id.slice(0, 8)}`;

        const newUser = {
            clerkId: data.id,
            username: username,
            imageUrl: data.image_url ?? "https://ui-avatars.com/api/?name=John+Doe",
        } satisfies typeof users.$inferInsert;

        try {
            await db.insert(users).values(newUser);
        } catch {
            // 如果用户名冲突，添加随机后缀
            const uniqueUsername = `${username}_${Date.now().toString().slice(-6)}`;
            await db.insert(users).values({
                ...newUser,
                username: uniqueUsername,
            });
        }
    }

    if(eventType === "user.deleted"){
        const { data } = evt
        if(!data.id){
            return new Response("Missing user id",{
                status:400
            })
        }
        await db.delete(users).where(eq(users.clerkId,data.id))
    }

    if(eventType === "user.updated"){
        const { data } = evt

        // 生成用户名（如果提供了新的 username）
        const username = data.username
            || data.email_addresses?.[0]?.email_address?.split('@')[0];

        const updateData: Partial<typeof users.$inferInsert> = {
            imageUrl: data.image_url,
        };

        if (username) {
            updateData.username = username;
        }

        await db
            .update(users)
            .set(updateData)
            .where(eq(users.clerkId, data.id));
    }

    return new Response("Webhook received",{status:200})
}