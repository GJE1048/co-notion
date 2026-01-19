"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, MoreHorizontal } from "lucide-react";
import { trpc } from "@/trpc/client";
import { TEMPLATE_CATEGORIES } from "@/modules/home/ui/components/templates-section";

const TemplatesPage = () => {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const createDocumentMutation = trpc.documents.createDocument.useMutation();

  const handleTemplateClick = async (template: { id: string; name: string }) => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    try {
      const newDocument = await createDocumentMutation.mutateAsync({
        title: template.name,
        templateId: template.id,
      });
      router.push(`/documents/${newDocument.id}`);
    } catch (error) {
      console.error("使用模板创建文档失败:", error);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          模板中心
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          从经过精心设计的模板开始，快速创建你的文档。
        </p>
      </div>

      <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            推荐模板
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {TEMPLATE_CATEGORIES.map((category) => (
            <section key={category.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <category.icon className={`size-5 ${category.color}`} />
                <h2 className="font-medium text-slate-900 dark:text-slate-100">
                  {category.name}
                </h2>
                <Badge variant="outline" className="text-xs">
                  {category.templates.length} 个模板
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {category.templates.map((template, index) => (
                  <button
                    key={index}
                    className="group text-left p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all cursor-pointer"
                    onClick={() => handleTemplateClick(template)}
                    disabled={createDocumentMutation.isPending}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-600 transition-colors">
                        <FileText size={16} />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity size-6"
                      >
                        <MoreHorizontal size={14} />
                      </Button>
                    </div>
                    <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1 text-sm">
                      {template.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {template.description}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default TemplatesPage;
