import http from "http";
import { WebSocketServer } from "ws";
// 使用 y-websocket 提供的服务器工具
// 通过相对路径引用以绕过 package exports 限制
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { setupWSConnection } = require("../node_modules/y-websocket/bin/utils.js") as {
  setupWSConnection: (socket: unknown, request: unknown) => void;
};

const port = Number(process.env.YJS_SERVER_PORT || 1234);

const server = http.createServer();

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  if (!req.url) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(
    req,
    socket as unknown as import("net").Socket,
    head,
    (ws) => {
      setupWSConnection(ws, req);
    }
  );
});

server.listen(port, () => {
  process.stdout.write(`Yjs WebSocket server listening on port ${port}\n`);
});
