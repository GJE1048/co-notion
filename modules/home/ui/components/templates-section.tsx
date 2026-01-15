"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Briefcase,
  GraduationCap,
  Lightbulb,
  MoreHorizontal
} from "lucide-react";

const templateCategories = [
  {
    id: "business",
    name: "商业文档",
    icon: Briefcase,
    color: "text-blue-600 dark:text-blue-400",
    templates: [
      { name: "会议纪要", description: "高效记录会议内容和决策" },
      { name: "项目计划", description: "规划和管理项目进度" },
      { name: "商业提案", description: "创建专业的商业提案" },
    ],
  },
  {
    id: "education",
    name: "教育文档",
    icon: GraduationCap,
    color: "text-green-600 dark:text-green-400",
    templates: [
      { name: "课程笔记", description: "整理课堂学习内容" },
      { name: "研究论文", description: "学术论文写作模板" },
      { name: "作业报告", description: "标准作业格式模板" },
    ],
  },
  {
    id: "creative",
    name: "创意写作",
    icon: Lightbulb,
    color: "text-purple-600 dark:text-purple-400",
    templates: [
      { name: "小说大纲", description: "构建小说结构框架" },
      { name: "博客文章", description: "专业博客写作模板" },
      { name: "创意日记", description: "记录灵感和想法" },
    ],
  },
];

export const TemplatesSection = () => {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();

  const handleBrowseAllClick = () => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    // TODO: 实现模板浏览页面
    router.push("/templates");
  };

  const handleTemplateClick = (templateName: string) => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    // TODO: 实现模板使用逻辑
    console.log("使用模板:", templateName);
  };

  return (
    <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          推荐模板
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-600 dark:text-slate-400"
          onClick={handleBrowseAllClick}
        >
          浏览全部
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {templateCategories.map((category) => (
          <div key={category.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <category.icon className={`size-5 ${category.color}`} />
              <h3 className="font-medium text-slate-900 dark:text-slate-100">
                {category.name}
              </h3>
              <Badge variant="outline" className="text-xs">
                {category.templates.length} 个模板
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {category.templates.map((template, index) => (
                <div
                  key={index}
                  className="group p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all cursor-pointer"
                  onClick={() => handleTemplateClick(template.name)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-600 transition-colors">
                      <FileText size={16} />
                    </div>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity size-6">
                      <MoreHorizontal size={14} />
                    </Button>
                  </div>
                  <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-1 text-sm">
                    {template.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {template.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
