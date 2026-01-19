import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "./redis";

// 只在 Redis 可用时创建 rate limiter
export const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(1000000, "10s"),
    })
  : null;
