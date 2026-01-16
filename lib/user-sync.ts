import { db } from "@/db";
import { users } from "@/db/schema";
import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

/**
 * 确保 Clerk 用户在数据库中存在，如果不存在则自动创建
 * @param clerkUserId Clerk 用户 ID
 * @returns 数据库中的用户对象
 */
export async function ensureUserExists(clerkUserId: string) {
  // 尝试查找用户
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUserId));

  // 如果用户不存在，尝试自动创建
  if (!user) {
    try {
      // 获取 Clerk 用户信息来创建用户
      const clerkUser = await currentUser();

      if (!clerkUser) {
        throw new Error('无法获取 Clerk 用户信息');
      }

      // 生成唯一的用户名
      const username = clerkUser.username
        || clerkUser.emailAddresses?.[0]?.emailAddress?.split('@')[0]
        || `user_${clerkUser.id.slice(0, 8)}`;

      const newUser = {
        clerkId: clerkUser.id,
        username: username,
        imageUrl: clerkUser.imageUrl || "https://ui-avatars.com/api/?name=John+Doe",
      };

      // 尝试插入用户，如果用户名冲突则添加随机后缀
      try {
        await db.insert(users).values(newUser);
        console.log(`自动创建用户: ${username} (${clerkUser.id})`);
      } catch (insertError: unknown) {
        if (insertError && typeof insertError === 'object' && 'code' in insertError && insertError.code === '23505') { // 唯一约束违反
          const uniqueUsername = `${username}_${Date.now().toString().slice(-6)}`;
          await db.insert(users).values({
            ...newUser,
            username: uniqueUsername,
          });
          console.log(`自动创建用户（用户名冲突）: ${uniqueUsername} (${clerkUser.id})`);
        } else {
          throw insertError;
        }
      }

      // 重新查询用户
      [user] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkUserId));

      if (!user) {
        throw new Error('用户创建后仍无法找到');
      }
    } catch (error) {
      console.error('自动创建用户失败:', error);
      throw new Error('用户同步失败，请联系管理员或稍后重试');
    }
  }

  return user;
}

/**
 * 获取当前登录用户的数据库记录，如果不存在则自动创建
 * @returns 数据库中的用户对象
 */
export async function getCurrentUser() {
  const { auth } = await import("@clerk/nextjs/server");
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    throw new Error('用户未登录');
  }

  return await ensureUserExists(clerkUserId);
}
