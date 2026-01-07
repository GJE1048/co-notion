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

        const newUser = {
            clerkId: data.id,
            lastName: data.last_name ?? "",
            firstName: data.first_name ?? "",
            imageUrl: data.image_url ?? "https://ui-avatars.com/api/?name=John+Doe",
        } satisfies typeof users.$inferInsert;

        await db.insert(users).values(newUser);
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

        await db
            .update(users)
            .set({
                firstName:data.first_name || "",
                lastName:data.last_name || "",
                imageUrl:data.image_url
            })
    }

    return new Response("Webhook received",{status:200})

}