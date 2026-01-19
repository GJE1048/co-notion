import { auth } from "@clerk/nextjs/server";
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";
import { ratelimit } from "@/lib/ratelimit";
import { ensureUserExists } from "@/lib/user-sync";

export const createTRPCContext = cache(async()=>{
    const {userId} = await auth();

    return {clerkUserId : userId};
})

export type Context = Awaited<ReturnType<typeof createTRPCContext>>

export type ProtectedContext = Context & {
  user: {
    id: string;
    username: string;
    clerkId: string;
    imageUrl: string;
    createdAt: Date;
    updatedAt: Date;
  };
  defaultWorkspace?: {
    id: string;
    name: string;
    ownerId: string;
    isPersonal: boolean;
    permissions: Record<string, unknown>;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
  };
}

// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.

const t = initTRPC.context<Context>().create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
});
//Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async function isAuth(opts) {
    const { ctx } = opts;
    if(!ctx.clerkUserId){
        throw new TRPCError({ code : "UNAUTHORIZED"})
    }

    // 使用 ensureUserExists 确保用户存在，如果不存在则自动创建
    const user = await ensureUserExists(ctx.clerkUserId);

    // 只在 rate limiter 可用时进行限制检查
    if (ratelimit) {
      try {
        const {success} = await ratelimit.limit(user.id);
        if(!success){
          throw new TRPCError({code : "TOO_MANY_REQUESTS", message: "请求过于频繁，请稍后再试"})
        }
      } catch (error) {
        // 如果 rate limiting 失败（例如 Redis 连接问题），在开发环境中允许继续
        // 在生产环境中应该记录错误并决定是否允许请求
        if (process.env.NODE_ENV === 'production') {
          console.error('Rate limiting error:', error);
          throw new TRPCError({code : "INTERNAL_SERVER_ERROR", message: "服务暂时不可用"})
        }
        // 开发环境中跳过 rate limiting
        console.warn('Rate limiting unavailable, skipping check:', error);
      }
    }

    return opts.next({
        ctx:{
            ...ctx,
            user,
        } as ProtectedContext
    })
})
