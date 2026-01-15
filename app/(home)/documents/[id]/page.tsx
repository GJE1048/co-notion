import { db } from "@/db";
import { documents, users } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { DocumentEditor } from "@/modules/documents/ui/components/document-editor";

interface DocumentPageProps {
  params: Promise<{
    id: string;
  }>;
}

const DocumentPage = async ({ params }: DocumentPageProps) => {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect("/sign-in");
  }

  const { id } = await params;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUserId));

  if (!user) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          文档
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          找不到当前用户，请确认Clerk Webhook是否已正确配置。
        </p>
      </div>
    );
  }

  const [document] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id));

  if (!document) {
    notFound();
  }

  // 验证文档所有权
  if (document.userId !== user.id) {
    redirect("/documents");
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <DocumentEditor document={document} />
    </div>
  );
};

export default DocumentPage;

