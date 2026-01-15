import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

interface DocumentsLayoutProps {
  children: React.ReactNode;
}

const DocumentsLayout = ({ children }: DocumentsLayoutProps) => {
  const { userId } = auth();

  if (!userId) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-5xl mx-auto px-4 py-8">{children}</div>
    </div>
  );
};

export default DocumentsLayout;


