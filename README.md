This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 最新更新：Clerk 用户自动创建功能

### 问题解决

如果遇到 "Database connection error: Failed query" 错误，这是因为 Clerk 用户登录后在数据库中没有对应记录。

**解决方案已实现：**
- ✅ 修改了 `app/(home)/documents/page.tsx` 页面，在找不到用户时自动创建
- ✅ 创建了 `lib/user-sync.ts` 工具函数，提供通用的用户同步功能
- ✅ 自动处理用户名冲突，避免数据库错误

### 功能特点

- 🔄 **自动用户创建**：Clerk 登录时自动在数据库创建用户记录
- 🛡️ **冲突处理**：用户名重复时自动添加随机后缀
- 🎯 **统一接口**：提供 `getCurrentUser()` 函数供其他页面使用
- 📝 **错误日志**：详细记录用户创建过程

## 环境配置

1. 创建 `.env.local` 文件：
```env
# 数据库配置
DATABASE_URL="postgresql://username:password@localhost:5432/your_database"

# Clerk 认证配置
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_SIGNING_SECRET="whsec_..."

# Redis 配置 (可选)
REDIS_URL="redis://localhost:6379"
```

2. 设置数据库：
```bash
npm run db:push  # 推送 schema 到数据库
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
