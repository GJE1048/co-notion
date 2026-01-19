import http from "http";
import { Socket } from "net";
import { WebSocketServer, WebSocket } from "ws";

type ClientMeta = {
  socket: WebSocket;
  documentId: string | null;
  username: string | null;
};

const port = Number(process.env.REALTIME_SERVER_PORT || 4000);

const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
  if (!req.url) {
    res.statusCode = 400;
    res.end("Bad request");
    return;
  }

  if (req.method === "POST" && req.url === "/events/document-operations") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const data = JSON.parse(body) as { documentId?: string; latestVersion?: number };
        if (data.documentId) {
          broadcastToDocument(data.documentId, {
            type: "document_operations_updated",
            documentId: data.documentId,
            latestVersion: data.latestVersion ?? null,
          });
        }
      } catch {
      }
      res.statusCode = 200;
      res.end("ok");
    });
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
});

const wss = new WebSocketServer({ noServer: true });

const clients = new Set<ClientMeta>();

const broadcastPresence = (documentId: string) => {
  const onlineUsernames = Array.from(clients)
    .filter((c) => c.documentId === documentId && c.username)
    .map((c) => c.username as string);

  const payload = JSON.stringify({
    type: "presence",
    documentId,
    onlineUsernames,
  });

  for (const client of clients) {
    if (client.documentId === documentId) {
      try {
        client.socket.send(payload);
      } catch {
      }
    }
  }
};

const broadcastToDocument = (documentId: string, message: unknown) => {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.documentId === documentId) {
      try {
        client.socket.send(payload);
      } catch {
      }
    }
  }
};

const handleConnection = (socket: WebSocket) => {
  const meta: ClientMeta = {
    socket,
    documentId: null,
    username: null,
  };

  clients.add(meta);

  socket.on("message", (data: unknown) => {
    let parsed: unknown;
    try {
      const str =
        typeof data === "string"
          ? data
          : data instanceof Buffer
          ? data.toString("utf-8")
          : "";
      if (!str) {
        return;
      }
      parsed = JSON.parse(str);
    } catch {
      return;
    }

    if (!parsed || typeof parsed !== "object") {
      return;
    }

    const msg = parsed as {
      type?: string;
      documentId?: string;
      username?: string;
      latestVersion?: number;
    };

    if (msg.type === "join_document" && msg.documentId && msg.username) {
      meta.documentId = msg.documentId;
      meta.username = msg.username;
      broadcastPresence(msg.documentId);
      return;
    }

    if (msg.type === "leave_document" && msg.documentId) {
      if (meta.documentId === msg.documentId) {
        meta.documentId = null;
        meta.username = null;
        broadcastPresence(msg.documentId);
      }
      return;
    }

    if (msg.type === "heartbeat" && meta.documentId) {
      return;
    }

    if (msg.type === "document_operations_updated" && msg.documentId) {
      broadcastToDocument(msg.documentId, {
        type: "document_operations_updated",
        documentId: msg.documentId,
        latestVersion: msg.latestVersion ?? null,
      });
    }
  });

  socket.on("close", () => {
    const documentId = meta.documentId;
    clients.delete(meta);
    if (documentId) {
      broadcastPresence(documentId);
    }
  });

  socket.on("error", () => {
    const documentId = meta.documentId;
    clients.delete(meta);
    if (documentId) {
      broadcastPresence(documentId);
    }
  });
};

server.on("upgrade", (req: http.IncomingMessage, socket: Socket, head: Buffer) => {
  if (!req.url) {
    socket.destroy();
    return;
  }

  if (req.url === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      handleConnection(ws);
    });
  } else {
    socket.destroy();
  }
});

server.listen(port, () => {
  process.stdout.write(`Realtime WebSocket server listening on port ${port}\n`);
});
