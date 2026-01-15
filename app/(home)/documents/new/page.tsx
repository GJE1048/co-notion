import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { NewDocumentForm } from "@/modules/documents/ui/components/new-document-form";

const NewDocumentPage = async () => {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect("/sign-in");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUserId));

  if (!user) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          创建文档
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          找不到当前用户，请确认Clerk Webhook是否已正确配置。
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          新建文档
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          创建一个新的文档开始你的工作
        </p>
      </div>

      <NewDocumentForm userId={user.id} />
    </div>
  );
};

export default NewDocumentPage;

