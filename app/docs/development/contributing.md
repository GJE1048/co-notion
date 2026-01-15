# 贡献指南

欢迎为智能化多人文档编辑平台项目做出贡献！我们非常感谢所有形式的贡献，包括但不限于：

- 🐛 报告bug
- 💡 提出新功能建议
- 📝 改进文档
- 🔧 提交代码修复
- 🎨 改进UI/UX
- 🌍 翻译和本地化
- 📊 性能优化
- 🧪 编写测试

## 快速开始

### 1. 准备开发环境

请先按照 [开发环境搭建指南](setup.md) 配置你的开发环境。

### 2. 了解项目结构

```
├── app/                    # Next.js 应用目录
│   ├── (auth)/            # 认证相关页面
│   ├── (home)/            # 主页面
│   ├── api/               # API 路由
│   └── docs/              # 文档
├── components/            # React 组件
├── lib/                   # 工具库
├── modules/               # 业务模块
├── trpc/                  # tRPC 配置
└── types/                 # TypeScript 类型定义
```

### 3. 选择任务

查看 [GitHub Issues](https://github.com/your-org/document-platform/issues) 寻找适合你的任务：

- 🏷️ `good first issue`: 适合新贡献者的简单任务
- 🏷️ `help wanted`: 需要帮助的任务
- 🏷️ `bug`: 错误修复
- 🏷️ `enhancement`: 功能增强
- 🏷️ `documentation`: 文档改进

## 开发工作流

### 1. Fork 项目

点击 GitHub 页面上的 "Fork" 按钮创建你的 fork。

### 2. 克隆你的 fork

```bash
git clone https://github.com/your-username/document-platform.git
cd document-platform
```

### 3. 添加上游仓库

```bash
git remote add upstream https://github.com/your-org/document-platform.git
```

### 4. 创建功能分支

```bash
# 从最新主分支创建
git checkout main
git pull upstream main

# 创建功能分支
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/issue-number-description
```

### 5. 开发和测试

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 运行测试
pnpm test

# 代码检查
pnpm lint
pnpm type-check
```

### 6. 提交更改

```bash
# 添加更改的文件
git add .

# 提交更改 (请使用有意义的提交信息)
git commit -m "feat: add new feature description

- What was changed
- Why it was changed
- How it was implemented"

# 推送到你的 fork
git push origin feature/your-feature-name
```

### 7. 创建 Pull Request

1. 访问你的 GitHub fork
2. 点击 "Compare & pull request"
3. 填写 PR 描述，包括：
   - 解决的问题
   - 实现方案
   - 测试方式
   - 截图 (如果适用)

## 代码规范

### TypeScript/JavaScript 规范

- 使用 TypeScript 进行开发
- 遵循 [ESLint](https://eslint.org/) 配置
- 使用 [Prettier](https://prettier.io/) 格式化代码
- 变量和函数使用 camelCase
- 组件使用 PascalCase
- 文件名使用 kebab-case

### React 规范

- 使用函数组件和 Hooks
- 使用 TypeScript 进行类型检查
- 使用自定义 Hooks 提取可复用逻辑
- 组件文件以 `.tsx` 结尾

### 提交信息规范

我们遵循 [Conventional Commits](https://conventionalcommits.org/) 规范：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**提交类型**:
- `feat`: 新功能
- `fix`: 错误修复
- `docs`: 文档变更
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或工具配置变更
- `perf`: 性能优化
- `ci`: CI 配置变更
- `revert`: 撤销之前的提交

**示例**:
```
feat(auth): add OAuth2 login support

- Implement Google OAuth2 login flow
- Add user profile sync from OAuth provider
- Update login UI to include OAuth buttons

Closes #123
```

### 分支命名规范

- `feature/xxx`: 新功能开发
- `fix/xxx`: 错误修复
- `docs/xxx`: 文档更新
- `refactor/xxx`: 代码重构
- `test/xxx`: 测试相关
- `chore/xxx`: 工具和配置更新

## 测试要求

### 单元测试

- 为所有工具函数编写单元测试
- 使用 Jest 和 React Testing Library
- 测试覆盖率应不低于 80%

```typescript
// 组件测试示例
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### 集成测试

- 测试组件间的交互
- 测试 API 调用的完整流程
- 使用测试数据库进行数据层测试

### E2E 测试

- 使用 Playwright 进行端到端测试
- 覆盖关键用户流程
- 定期运行以确保功能正常

## 代码审查

### 审查清单

**功能完整性**:
- [ ] 功能按预期工作
- [ ] 错误处理完善
- [ ] 边界情况已处理
- [ ] 性能影响已考虑

**代码质量**:
- [ ] 代码符合项目规范
- [ ] 类型定义正确
- [ ] 测试覆盖充分
- [ ] 文档已更新

**安全考虑**:
- [ ] 无安全漏洞
- [ ] 敏感信息未泄露
- [ ] 输入验证到位
- [ ] 权限检查完善

### 审查流程

1. **自动检查**: CI/CD 运行测试和代码检查
2. **同行审查**: 至少一位维护者审查代码
3. **测试验证**: 在测试环境验证功能
4. **合并批准**: 审查通过后合并到主分支

## 文档贡献

### 更新现有文档

1. 找到相关文档文件
2. 进行必要的修改
3. 确保格式正确
4. 提交 PR

### 添加新文档

1. 在合适位置创建新文档
2. 遵循现有文档的格式和结构
3. 在 README 或相关文档中添加链接
4. 提交 PR

### 文档规范

- 使用 Markdown 格式
- 保持语言简洁明了
- 包含必要的代码示例
- 更新目录和链接

## 问题报告

### Bug 报告

请使用 [GitHub Issues](https://github.com/your-org/document-platform/issues) 报告 bug：

**标题格式**: `[Bug] 简洁的错误描述`

**内容包含**:
- 错误的详细描述
- 重现步骤
- 期望的行为
- 实际的行为
- 环境信息 (浏览器、操作系统、版本等)
- 相关截图或错误日志

### 功能请求

**标题格式**: `[Feature] 功能名称`

**内容包含**:
- 功能描述
- 使用场景
- 预期效果
- 相关截图或原型 (如果有)

## 社区规范

### 行为准则

我们致力于维护一个开放、包容和尊重的社区。请遵守以下行为准则：

- **尊重他人**: 尊重不同的观点和经验
- **建设性沟通**: 提供建设性的反馈
- **包容性**: 欢迎各种背景的贡献者
- **专业性**: 保持专业和礼貌的沟通

### 沟通渠道

- **GitHub Issues**: 技术问题和 bug 报告
- **GitHub Discussions**: 一般讨论和问题解答
- **Discord/Slack**: 实时沟通 (如果有)

## 奖励与认可

### 贡献者认可

- 所有贡献者都会在项目中得到认可
- 活跃贡献者可能被邀请成为项目维护者
- 重大贡献会在发布说明中特别提及

### 贡献者墙

贡献者列表会定期更新，感谢所有为项目做出贡献的人。

## 许可证

通过提交贡献，你同意你的代码将根据项目的 MIT 许可证进行许可。

## 联系我们

如果你有任何问题或需要帮助：

- 查看 [常见问题](https://github.com/your-org/document-platform/discussions)
- 在 GitHub Issues 中提问
- 联系维护团队

感谢你的贡献！🚀
