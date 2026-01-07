import { FileText, Heart, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PageProps {
  searchParams: Promise<{
    categoryId?: string;
  }>
};

const Page = async ({ }: PageProps) => {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">工作空间</h1>
        <p className="text-gray-600">组织和管理你的所有内容</p>
      </div>

      {/* 快速操作 */}
      <div className="mb-8">
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          新建页面
        </Button>
      </div>

      {/* 内容网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 最近访问 */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-blue-500" />
              最近访问
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="font-medium text-sm">项目计划文档</p>
                <p className="text-xs text-gray-500">2 小时前</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="font-medium text-sm">会议纪要</p>
                <p className="text-xs text-gray-500">昨天</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="font-medium text-sm">产品规格说明</p>
                <p className="text-xs text-gray-500">3 天前</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 收藏夹 */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Heart className="h-5 w-5 text-red-500" />
              收藏夹
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="font-medium text-sm">设计系统指南</p>
                <p className="text-xs text-gray-500">重要文档</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="font-medium text-sm">团队规范</p>
                <p className="text-xs text-gray-500">团队文档</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="font-medium text-sm">项目路线图</p>
                <p className="text-xs text-gray-500">项目管理</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 工作区概览 */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-green-500" />
              工作区概览
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">总页面数</span>
              <span className="font-semibold">24</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">最近编辑</span>
              <span className="font-semibold">8</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">共享页面</span>
              <span className="font-semibold">12</span>
            </div>
          </CardContent>
        </Card>

        {/* 空白卡片 - 用于扩展 */}
        <Card className="hover:shadow-md transition-shadow border-dashed border-2 border-gray-300 hover:border-gray-400">
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <Plus className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">创建新内容</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Page;