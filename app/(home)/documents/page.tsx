import { trpc } from "@/trpc/server";
import { DocumentsView } from "@/modules/documents/ui/views/documents-view";

export const dynamic = "force-dynamic";

const DocumentsPage = async () => {
  // 预取用户文档数据
  void trpc.documents.getUserDocuments.prefetch();

  return <DocumentsView />;
};

export default DocumentsPage;


