import { createTRPCRouter, baseProcedure } from "../init";
import { documentsRouter } from "@/modules/documents/server/procedures";
import { blocksRouter } from "@/modules/blocks/server/procedures";
import { workspacesRouter } from "@/modules/workspaces/server/procedures";
import { devRouter } from "./dev";

export const appRouter = createTRPCRouter({
  // Health check procedure - can be removed when adding actual procedures
  health: baseProcedure.query(() => ({ status: "ok" })),

  // 开发环境路由
  dev: devRouter,

  // 文档相关路由
  documents: documentsRouter,

  // Block 相关路由
  blocks: blocksRouter,

  // 工作区相关路由
  workspaces: workspacesRouter,
})

export type AppRouter = typeof appRouter;