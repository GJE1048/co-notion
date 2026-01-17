import { createTRPCRouter, baseProcedure } from "../init";
import { documentsRouter } from "@/modules/documents/server/procedures";
import { blocksRouter } from "@/modules/blocks/server/procedures";
import { workspacesRouter } from "@/modules/workspaces/server/procedures";
import { homeRouter } from "./home";

export const appRouter = createTRPCRouter({
  health: baseProcedure.query(() => ({ status: "ok" })),

  home: homeRouter,

  documents: documentsRouter,

  blocks: blocksRouter,

  workspaces: workspacesRouter,
});

export type AppRouter = typeof appRouter;
