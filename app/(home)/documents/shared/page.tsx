import { trpc } from "@/trpc/server";
import { SharedDocumentsView } from "@/modules/documents/ui/views/shared-documents-view";

export const dynamic = "force-dynamic";

const SharedDocumentsPage = async () => {
  void trpc.documents.getSharedDocumentsByMe.prefetch();

  return <SharedDocumentsView />;
};

export default SharedDocumentsPage;

