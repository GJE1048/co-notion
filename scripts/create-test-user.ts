import { db } from "../db";
import { users } from "../db/schema";

async function createTestUser() {
  try {
    console.log("Creating test user with clerk_id: user_38IKY4WIClYlfdcctC2Q6Gd955R");

    const newUser = {
      clerkId: "user_38IKY4WIClYlfdcctC2Q6Gd955R",
      username: "testuser",
      imageUrl: "https://ui-avatars.com/api/?name=Test+User",
    };

    const result = await db.insert(users).values(newUser).returning();
    console.log("✅ User created successfully:", result[0]);

  } catch (error) {
    console.error("❌ Failed to create user:", error);
  }
}

createTestUser();
