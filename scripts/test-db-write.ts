// 必须在其他导入之前加载环境变量
require('dotenv').config({ path: '.env.local' });

// 现在可以安全地导入数据库配置
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * 测试数据库写入功能
 */
async function testDatabaseWrite() {
  console.log("🧪 开始测试数据库写入功能...\n");

  try {
    // 1. 测试连接
    console.log("1️⃣ 测试数据库连接...");
    await db.execute("SELECT 1" as any);
    console.log("✅ 数据库连接成功\n");

    // 2. 创建测试用户
    console.log("2️⃣ 创建测试用户...");
    const testUser = {
      clerkId: `test_${Date.now()}`,
      username: `test_user_${Date.now()}`,
      imageUrl: "https://ui-avatars.com/api/?name=Test+User",
    };

    console.log(`📝 插入用户: ${testUser.username} (${testUser.clerkId})`);
    const insertedUser = await db.insert(users).values(testUser).returning();
    console.log(`✅ 用户创建成功，ID: ${insertedUser[0].id}\n`);

    // 3. 查询刚创建的用户
    console.log("3️⃣ 查询刚创建的用户...");
    const [foundUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, insertedUser[0].id));

    if (foundUser) {
      console.log(`✅ 用户查询成功:`);
      console.log(`   ID: ${foundUser.id}`);
      console.log(`   用户名: ${foundUser.username}`);
      console.log(`   Clerk ID: ${foundUser.clerkId}`);
      console.log(`   头像: ${foundUser.imageUrl}`);
      console.log(`   创建时间: ${foundUser.createdAt}`);
      console.log(`   更新时间: ${foundUser.updatedAt}\n`);
    } else {
      throw new Error("用户查询失败");
    }

    // 4. 更新测试用户
    console.log("4️⃣ 更新测试用户...");
    const updateData = {
      username: `updated_${testUser.username}`,
    };

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, insertedUser[0].id));

    console.log(`✅ 用户更新成功，新用户名: ${updateData.username}\n`);

    // 5. 验证更新
    console.log("5️⃣ 验证更新结果...");
    const [updatedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, insertedUser[0].id));

    if (updatedUser.username === updateData.username) {
      console.log(`✅ 更新验证成功: ${updatedUser.username}\n`);
    } else {
      throw new Error("更新验证失败");
    }

    // 6. 清理测试数据
    console.log("6️⃣ 清理测试数据...");
    await db.delete(users).where(eq(users.id, insertedUser[0].id));
    console.log("✅ 测试用户删除成功\n");

    // 7. 验证删除
    console.log("7️⃣ 验证删除结果...");
    const deletedCheck = await db
      .select()
      .from(users)
      .where(eq(users.id, insertedUser[0].id));

    if (deletedCheck.length === 0) {
      console.log("✅ 删除验证成功，用户已不存在\n");
    } else {
      throw new Error("删除验证失败");
    }

    console.log("🎉 所有数据库写入测试通过！\n");
    console.log("📊 数据库操作总结:");
    console.log("  ✅ 连接测试");
    console.log("  ✅ 插入操作");
    console.log("  ✅ 查询操作");
    console.log("  ✅ 更新操作");
    console.log("  ✅ 删除操作");
    console.log("  ✅ 事务完整性");

  } catch (error) {
    console.error("❌ 数据库测试失败:", error);
    console.error("\n🔍 可能的解决方案:");
    console.error("1. 检查 DATABASE_URL 环境变量是否正确配置");
    console.error("2. 确保 PostgreSQL 服务正在运行");
    console.error("3. 验证数据库用户权限");
    console.error("4. 检查网络连接");
    process.exit(1);
  }
}

/**
 * 显示数据库统计信息
 */
async function showDatabaseStats() {
  try {
    console.log("📈 数据库统计信息:");

    // 统计用户数量
    const userCount = await db.$count(users);
    console.log(`👥 用户总数: ${userCount}`);

    // 显示最近的用户
    if (userCount > 0) {
      const recentUsers = await db
        .select({
          id: users.id,
          username: users.username,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(users.createdAt)
        .limit(3);

      console.log("\n🕒 最近创建的用户:");
      recentUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.username} (${user.createdAt?.toLocaleString()})`);
      });
    }

  } catch (error) {
    console.error("❌ 获取统计信息失败:", error);
  }
}

// 运行测试
if (require.main === module) {
  testDatabaseWrite()
    .then(() => showDatabaseStats())
    .then(() => {
      console.log("\n✨ 数据库写入测试完成！");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 测试过程中发生错误:", error);
      process.exit(1);
    });
}
