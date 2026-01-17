const defaultEndpoint = "http://localhost:4000/events/document-operations";

export const notifyDocumentUpdated = async (documentId: string, latestVersion?: number | null) => {
  if (!documentId) {
    return;
  }

  const endpoint = process.env.REALTIME_SERVER_HTTP_URL || defaultEndpoint;

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentId,
        latestVersion: typeof latestVersion === "number" ? latestVersion : null,
      }),
    });
  } catch {
  }
};

