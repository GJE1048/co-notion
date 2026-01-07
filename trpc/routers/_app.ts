import { createTRPCRouter, baseProcedure } from "../init";

export const appRouter = createTRPCRouter({
  // Health check procedure - can be removed when adding actual procedures
  health: baseProcedure.query(() => ({ status: "ok" })),
})

export type AppRouter = typeof appRouter;