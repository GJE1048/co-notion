import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/user-sync";
import Link from "next/link";

const DocumentsPage = async () => {
  // 获取或自动创建当前用户
  const user = await getCurrentUser();

  const userDocuments = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, user.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            我的文档
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            管理你在 CO-NOTION 中的所有文档。
          </p>
        </div>
        <Link
          href="/documents/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          新建文档
        </Link>
      </div>

      {userDocuments.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-2">
            你还没有任何文档。
          </p>
          <p className="text-slate-500 dark:text-slate-500 mb-4 text-sm">
            从一个空白文档开始，或者回到首页选择一个模板。
          </p>
          <Link
            href="/documents/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            新建你的第一个文档
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {userDocuments.map((doc) => (
            <Link
              key={doc.id}
              href={`/documents/${doc.id}`}
              className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-4 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm transition-all"
            >
              <h2 className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {doc.title || "未命名文档"}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                创建时间：{" "}
                {doc.createdAt
                  ? new Date(doc.createdAt).toLocaleString()
                  : "未知"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;


