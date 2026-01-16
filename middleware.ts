// Next.js 要求在 middleware 文件内直接导出 config，避免 re-export
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware((auth, request) => {
  // 在开发环境下跳过认证检查
  if (process.env.NODE_ENV === 'development') {
    return;
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes except development routes
    "/(api|trpc)(.*)",
  ],
};
