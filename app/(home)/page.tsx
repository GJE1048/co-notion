import { QuickActions } from "@/modules/home/ui/components/quick-actions";
import { RecentDocuments } from "@/modules/home/ui/components/recent-documents";
import { WorkspaceOverview } from "@/modules/home/ui/components/workspace-overview";
import { TemplatesSection } from "@/modules/home/ui/components/templates-section";

interface PageProps {
    searchParams: Promise<{
      categoryId?: string;
    }>
  };

  const Page = async ({  }: PageProps) => {

    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
          {/* 页面标题 */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
              欢迎使用智能文档平台
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              创建、协作、管理你的文档，让工作更高效
            </p>
          </div>

          {/* 快速操作区域 */}
          <QuickActions />

          {/* 主要内容区域 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 左侧主要内容 */}
            <div className="lg:col-span-2 space-y-8">
              <RecentDocuments />
              <TemplatesSection />
            </div>

            {/* 右侧边栏 */}
            <div className="space-y-8">
              <WorkspaceOverview />
            </div>
          </div>
        </div>
      </div>
    );
  };

  export default Page;