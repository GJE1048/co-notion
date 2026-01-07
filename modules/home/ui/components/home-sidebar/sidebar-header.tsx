"use client";

import { Search, Plus, Settings, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@clerk/nextjs";

export const SidebarHeader = () => {
  const { user } = useUser();

  return (
    <div className="p-4 border-b border-sidebar-border">
      {/* 用户信息区域 */}
      <div className="flex items-center gap-3 mb-4">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user?.imageUrl} />
          <AvatarFallback>
            {user?.firstName?.charAt(0) || user?.username?.charAt(0) || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-sidebar-foreground truncate">
            {user?.firstName || user?.username || "用户"}
          </p>
          <p className="text-xs text-sidebar-foreground/70 truncate">
            个人工作空间
          </p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* 搜索框 */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-sidebar-foreground/50" />
        <Input
          placeholder="搜索页面..."
          className="pl-9 h-9 bg-sidebar-accent/50 border-sidebar-border focus:bg-sidebar-accent"
        />
      </div>

      {/* 快速操作 */}
      <Button className="w-full justify-start gap-2 h-9" size="sm">
        <Plus className="h-4 w-4" />
        新建页面
      </Button>
    </div>
  );
};
