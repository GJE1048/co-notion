import React from "react";

// 占位的 TRPCProvider，用于在未实现 tRPC 客户端时避免导入错误。
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  return children;
}

