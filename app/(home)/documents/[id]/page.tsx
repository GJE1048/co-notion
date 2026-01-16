import { trpc } from "@/trpc/server";
import { DocumentView } from "@/modules/documents/ui/views/document-view";

interface DocumentPageProps {
  params: Promise<{
    id: string;
  }>;
}

const DocumentPage = async ({ params }: DocumentPageProps) => {
  const { id } = await params;

  // 预取文档数据和 Blocks 数据
  void trpc.documents.getDocument.prefetch({ id });
  void trpc.documents.getDocumentBlocks.prefetch({ documentId: id });

  return <DocumentView documentId={id} />;
};

export default DocumentPage;

