# 清除 Clerk 登录信息

此文档介绍如何清除 Clerk 认证系统的登录信息。

## 清除方式

### 方式一：浏览器清除脚本（推荐）

1. 在浏览器中打开 `clear-clerk-session.html` 文件
2. 点击"清除登录信息"按钮
3. 脚本将自动清除所有 Clerk 相关的登录数据
4. 页面将自动刷新

**文件位置：** `clear-clerk-session.html`（项目根目录）

### 方式二：命令行脚本

运行以下命令清除本地的 Clerk 配置：

```bash
npm run clear:clerk
```

或直接运行：

```bash
node scripts/clear-clerk-session.js
```

## 清除的内容

### 浏览器脚本清除：
- ✅ HTTP Cookies 中的 Clerk 会话令牌
- ✅ LocalStorage 中的 Clerk 数据
- ✅ SessionStorage 中的 Clerk 数据

### 命令行脚本清除：
- ✅ 本地 Clerk 配置文件
- ✅ 环境变量文件中的 Clerk 令牌（可选）

## 手动清除方法

如果上述方法不够，可以手动清除：

### 在浏览器中：
1. 按 F12 打开开发者工具
2. 转到 **Application** 标签
3. 在 **Storage** 部分：
   - 清除 **Cookies** 中包含 "clerk" 的项
   - 清除 **Local Storage** 中包含 "clerk" 的项
   - 清除 **Session Storage** 中包含 "clerk" 的项

### 在命令行中：
```bash
# 查找并删除 Clerk 相关文件
find . -name "*clerk*" -type f -delete
find . -name ".clerk" -type d -exec rm -rf {} +
```

## 注意事项

⚠️ **警告：**
- 清除登录信息后，您将被登出
- 需要重新登录才能访问受保护的内容
- 此操作不可逆

## 故障排除

如果清除后仍有问题：

1. **硬刷新浏览器**：`Ctrl+Shift+R` (Windows/Linux) 或 `Cmd+Shift+R` (Mac)
2. **清除浏览器缓存**：设置 → 隐私 → 清除浏览数据
3. **使用无痕模式**：测试是否为缓存问题
4. **重启开发服务器**：`npm run dev`

## 相关文件

- `clear-clerk-session.html` - 浏览器清除脚本
- `scripts/clear-clerk-session.js` - 命令行清除脚本
- `package.json` - 包含 `clear:clerk` 命令
