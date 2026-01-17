declare module "ws" {
  import type { IncomingMessage } from "http";
  import type { Socket } from "net";

  export class WebSocket {
    readyState: number;
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
    close(code?: number, reason?: string): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
  }

  export class WebSocketServer {
    constructor(options: { noServer?: boolean });
    handleUpgrade(
      request: IncomingMessage,
      socket: Socket,
      head: Buffer,
      callback: (socket: WebSocket) => void
    ): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
  }
}

