// Simple test to verify user creation works
import { db } from "./db/index.js";
import { users } from "./db/schema.js";
import { eq } from "drizzle-orm";

async function testUserLookup() {
  try {
    console.log("Testing user lookup with clerk_id: user_38IKY4WIClYlfdcctC2Q6Gd955R");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, "user_38IKY4WIClYlfdcctC2Q6Gd955R"));

    if (user) {
      console.log("✅ User found:", user);
    } else {
      console.log("❌ User not found - this is expected since webhook didn't create the user");
    }

    // Check total user count
    const result = await db.$count(users);
    console.log(`Total users in database: ${result}`);

  } catch (error) {
    console.error("❌ Query failed:", error.message);
  }
}

testUserLookup();
