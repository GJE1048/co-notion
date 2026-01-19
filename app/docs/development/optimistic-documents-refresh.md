# Documents 页面无感刷新与乐观更新设计说明

## 1. 背景与目标

Documents 页面目前有两个体验问题：

- 数据刷新时会出现整页 loading，已有工作区和文档列表会短暂消失；
- 新建工作区依赖 `window.location.reload()`，用户会感觉页面“闪一下”，不符合协同编辑场景下的顺滑体验。

目标：

- 为 Documents 页面和工作区列表实现“无感刷新”（stale-while-revalidate 风格）：已有数据保持展示，后台静默刷新；
- 为“新建工作区”实现乐观更新：先更新 UI，再等待接口结果，失败时回滚并给出错误提示。

## 2. 技术基础：tRPC + TanStack Query

前端数据层基于 `@trpc/react-query`，底层使用 TanStack Query 管理缓存和请求状态。核心概念：

- `isLoading`: 首次加载且缓存中没有任何数据时为 `true`；
- `isFetching`: 任何网络请求进行中时为 `true`，包括后台重新获取数据；
- `staleTime`: 在此时间内数据视为“新鲜”，不会因为时间推移自动触发重新请求；
- `setData` / `getData` / `invalidate`: 操作查询缓存，实现乐观更新和强制刷新。

基于这些能力，可以实现：

- 首次加载显示整页 loading；
- 后续刷新仅在后台请求，不打断已有 UI；
- 新建工作区时先往缓存里插入一条“乐观工作区”记录，等接口结果再校正。

## 3. Documents 页面无感刷新策略

### 3.1 查询配置

在 `modules/documents/ui/views/documents-view.tsx` 中，对文档和工作区查询增加配置：

- 为 `getUserDocuments` 和 `getUserWorkspaces` 设置：
  - `staleTime: 30_000`：30 秒内视为新鲜，避免频繁重新请求；
  - `refetchOnWindowFocus: false`：避免切回浏览器标签页时瞬间触发请求并干扰体验。
- 为文档查询解构 `isLoading` 和 `isFetching`，用于区分“首次加载”和“后台刷新”。

这样：

- 首次进入 `/documents` 时会走一次完整加载；
- 后续触发 `invalidate` 或组件重渲染时，如果缓存里已有数据，会优先展示旧数据，同时在后台静默拉取新数据。

### 3.2 UI 行为约定

Documents 页面顶部的整体 loading 仅在“没有任何文档数据且正在首次加载”时展示：

- 当 `documents` 为空且 `isLoading === true` 时，显示整页加载态；
- 如果 `documents` 已经存在，即使正在 `isFetching`，也保持列表展示不变，只在需要时做轻量级的局部反馈（例如按钮 loading）。

这保证了在无论是重新进入页面，还是数据被重新拉取时，已有文档列表不会全部闪成 loading。

## 4. 新建工作区的乐观更新

### 4.1 原有行为

原来的 `createWorkspaceMutation` 行为：

- 调用成功后：
  - 关闭弹窗；
  - 重置输入内容；
  - 使用 `window.location.reload()` 刷新整个页面，以显示新工作区。

问题：

- 页面整体刷新，用户当前上下文（滚动位置、展开状态等）全部丢失；
- 对协同编辑场景不友好，感觉像是“跳了一下”。

### 4.2 新的乐观更新流程

新的实现使用 `onMutate` / `onError` / `onSettled` 三个生命周期完成乐观更新：

- `onMutate(input)`：
  - 关闭新建工作区弹窗，清空输入框；
  - `cancel` 当前 `getUserWorkspaces` 查询，避免旧请求覆盖乐观结果；
  - 通过 `getData()` 读取当前工作区列表作为 `previousWorkspaces`；
  - 构造一个“乐观工作区”对象：
    - `id` 使用 `optimistic-${timestamp}`；
    - `name` 来自用户输入；
    - `isPersonal` 取用户输入或默认 `true`；
    - `userRole` 固定为 `"creator"`；
  - 使用 `setData` 将乐观工作区插入缓存末尾：
    - 如果当前没有任何工作区，则设置为仅包含这一个的数组；
    - 否则在原数组基础上追加；
  - 返回 `{ previousWorkspaces }` 作为上下文，以便出错时回滚。

- `onError(error, input, context)`：
  - 如果有 `previousWorkspaces`，通过 `setData` 恢复原始工作区列表；
  - 通过弹窗（`alert`）提示用户“创建工作区失败，请稍后重试”。

- `onSettled`：
  - 对 `getUserWorkspaces` 调用 `invalidate()`，让缓存根据真实后端数据进行修正。

整体效果：

- 用户点击“创建工作区”后，列表中立即出现一个新的工作区分组；
- 页面不会整体刷新，仅局部列表更新；
- 如果接口失败，乐观插入的工作区会消失，并显示错误提示；
- 如果接口成功，后端返回的真实工作区会在下一次刷新中覆盖乐观数据。

## 5. 后续扩展建议

当前无感刷新与乐观更新已经覆盖：

- Documents 页面整体数据加载；
- 工作区列表和新建工作区交互；
- 文档删除；
- 共享文档管理页的协作者权限变更与移除。

### 5.1 文档删除的乐观更新

位置：

- `modules/documents/ui/views/documents-view.tsx` 中的 `deleteDocumentMutation`。

行为：

- 在 `onMutate` 中：
  - 取消当前 `getUserDocuments` 查询；
  - 缓存当前文档列表 `previousDocuments`；
  - 用 `setData` 从缓存里过滤掉被删文档，实现列表的即时更新。
- 在 `onError` 中：
  - 将缓存恢复为 `previousDocuments`；
  - 用弹窗提示“删除文档失败，请稍后重试”。
- 在 `onSettled` 中：
  - 对 `getUserDocuments` 调用 `invalidate()`，通过真实数据修正列表。

用户体验：

- 点击删除后，文档卡片会立即从列表中消失；
- 整个页面不会出现全局 loading 或闪烁；
- 如果后端删除失败，卡片会恢复，并给出错误提示。

### 5.2 共享文档管理页的乐观更新

位置：

- `modules/documents/ui/views/shared-documents-view.tsx` 中的 `updateCollaboratorRole` 和 `removeCollaborator`。

行为：

- 查询 `getSharedDocumentsByMe` 使用与 Documents 页面相同的无感刷新策略：
  - `staleTime: 30_000`
  - `refetchOnWindowFocus: false`

- `updateCollaboratorRole`：
  - `onMutate`：
    - 设置一个 `updatingKey` 标记正在更新的协作者；
    - 取消当前查询；
    - 缓存原始数据 `previous`；
    - 用 `setData` 在缓存中直接修改目标协作者的 `role` 字段。
  - `onError`：
    - 回滚到 `previous`；
    - 清空 `updatingKey`；
    - 弹窗提示“更新协作者权限失败，请稍后重试”。
  - `onSuccess`：
    - 清空 `updatingKey`。
  - `onSettled`：
    - 对 `getSharedDocumentsByMe` 调用 `invalidate()`。

- `removeCollaborator`：
  - `onMutate`：
    - 设置 `updatingKey` 标记当前删除操作；
    - 取消当前查询；
    - 缓存原始数据 `previous`；
    - 用 `setData` 在缓存中移除目标协作者。
  - `onError`：
    - 回滚缓存；
    - 清空 `updatingKey`；
    - 弹窗提示“移除协作者失败，请稍后重试”。
  - `onSuccess`：
    - 清空 `updatingKey`。
  - `onSettled`：
    - 通过 `invalidate()` 与后端数据对齐。

用户体验：

- 调整权限时，下拉框中的角色值会立即更新，不等待网络往返；
- 移除协作者时，列表中的那一行会立即消失；
- 如果网络或后端出错，界面会恢复到之前的状态，并给出错误提示。

## 6. 统一设计原则

- 尽量利用 TanStack Query 的缓存读写能力，而不是依赖整页刷新或 `window.location.reload()`；
- 所有乐观更新必须：
  - 在 `onMutate` 中记录可恢复的 `previous` 状态；
  - 在 `onError` 中负责回滚和错误提示；
  - 在 `onSettled` 中通过 `invalidate()` 与真实数据对齐；
- 乐观数据结构应尽量与真实接口返回结构保持一致，减少状态不一致窗口期。 
