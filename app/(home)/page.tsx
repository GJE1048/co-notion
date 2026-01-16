import { db } from "@/db";
import { documents, users } from "@/db/schema";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq, desc } from "drizzle-orm";
import { QuickActions } from "@/modules/home/ui/components/quick-actions";
import { RecentDocuments } from "@/modules/home/ui/components/recent-documents";
import { WorkspaceOverview } from "@/modules/home/ui/components/workspace-overview";
import { TemplatesSection } from "@/modules/home/ui/components/templates-section";

interface PageProps {
    searchParams: Promise<{
      categoryId?: string;
    }>
  };

  const Page = async ({  }: PageProps) => {
    const { userId: clerkUserId } = await auth();
    let recentDocs: typeof documents.$inferSelect[] = [];
    let userDoc: typeof users.$inferSelect | null = null;

    if (clerkUserId) {
      try {
        // 首先尝试查找用户
        let [user] = await db
          .select()
          .from(users)
          .where(eq(users.clerkId, clerkUserId));

        // 如果用户不存在，尝试从 Clerk 获取用户信息并创建用户记录
        if (!user) {
          try {
            const clerkUser = await currentUser();

            if (clerkUser) {
              // 生成唯一的用户名
              const username = clerkUser.username
                || clerkUser.emailAddresses?.[0]?.emailAddress?.split('@')[0]
                || `user_${clerkUserId.slice(0, 8)}`;

              const newUser = {
                clerkId: clerkUserId,
                username: username,
                imageUrl: clerkUser.imageUrl ?? "https://ui-avatars.com/api/?name=John+Doe",
              };

              // 尝试插入用户，如果用户名冲突则添加随机后缀
              try {
                const [createdUser] = await db
                  .insert(users)
                  .values(newUser)
                  .returning();

                user = createdUser;
              } catch {
                // 如果用户名冲突，添加随机后缀重试
                const uniqueUsername = `${username}_${Date.now().toString().slice(-6)}`;
                const [createdUser] = await db
                  .insert(users)
                  .values({
                    ...newUser,
                    username: uniqueUsername,
                  })
                  .returning();

                user = createdUser;
              }
            }
          } catch (createError) {
            console.error("Failed to create user:", createError);
            // 如果创建失败，继续执行，但 userDoc 保持为 null
          }
        }

        if (user) {
          userDoc = user;
          // 只有在成功获取用户信息后才尝试获取文档
          try {
            recentDocs = await db
              .select()
              .from(documents)
              .where(eq(documents.ownerId, user.id))
              .orderBy(desc(documents.updatedAt))
              .limit(5);
          } catch (docsError) {
            console.error("Failed to fetch documents:", docsError);
            // 文档获取失败时，保持为空数组
            recentDocs = [];
          }
        }
      } catch (dbError) {
        console.error("Database connection error:", dbError);
        // 数据库连接失败时，继续显示页面，但没有用户数据
        // 这允许认证用户看到主页面，即使数据库不可用
      }
    }

    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
          {/* 页面标题 */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
              欢迎使用智能文档平台
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              创建、协作、管理你的文档，让工作更高效
            </p>
          </div>

          {/* 快速操作区域 */}
          <QuickActions />

          {/* 主要内容区域 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 左侧主要内容 */}
            <div className="lg:col-span-2 space-y-8">
              <RecentDocuments documents={recentDocs} />
              <TemplatesSection />
            </div>

            {/* 右侧边栏 */}
            <div className="space-y-8">
              <WorkspaceOverview />
            </div>
          </div>
        </div>
      </div>
    );
  };

  export default Page;