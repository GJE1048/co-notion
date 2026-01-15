import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { HomeLayout } from "@/modules/home/ui/layouts/home-layout";

interface LayoutProps {
  children: React.ReactNode;
};

const Layout = async ({ children }: LayoutProps) => {
  // 移除登录检查，允许未登录用户访问主页面
  return (
    <HomeLayout>
      {children}
    </HomeLayout>
  );
};

export default Layout;
