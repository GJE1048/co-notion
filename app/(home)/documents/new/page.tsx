import { NewDocumentForm } from "@/modules/documents/ui/components/new-document-form";

const NewDocumentPage = () => {
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

      <NewDocumentForm />
    </div>
  );
};

export default NewDocumentPage;

