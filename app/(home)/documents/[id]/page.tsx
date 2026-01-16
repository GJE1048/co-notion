import { trpc } from "@/trpc/server";
import { DocumentView } from "@/modules/documents/ui/views/document-view";

interface DocumentPageProps {
  params: Promise<{
    id: string;
  }>;
}

const DocumentPage = async ({ params }: DocumentPageProps) => {
  const { id } = await params;

  // 在开发环境中，服务器端预取会导致认证问题，因此移除预取
  // 数据将在客户端加载
  // void trpc.documents.getDocument.prefetch({ id });
  // void trpc.documents.getDocumentBlocks.prefetch({ documentId: id });

  return <DocumentView documentId={id} />;
};

export default DocumentPage;

