# LibreChat 笔记工作区更新记录（2026-03-27）

## 本次目标

在 `Chat` 右侧笔记区继续完善「可用性优先」的 MVP，重点解决日常写作体验问题，不做大范围架构重构。

## 本次完成内容

### 1) 笔记树交互增强

- 支持笔记/文件夹重命名（项目内弹窗样式）
- 支持笔记/文件夹删除（项目内确认弹窗，替代浏览器 `confirm`）
- 支持在文件夹内创建笔记（树节点快捷按钮 + 文件夹详情区按钮）

### 2) 保存体验优化

- 自动保存节流改为约 `3s`
- 修复保存后光标跳动导致输入中断的问题（避免无意义重置编辑器内容）

### 3) 布局与收起能力

- 笔记文件树支持收起/展开
- 顶部 Header 增加笔记面板显示切换按钮（可隐藏整个右侧笔记面板）

### 4) 代码块观感优化

- 集成 `@blocknote/code-block`，让代码块有更好的高亮体验

### 5) Dev 标记关闭

- 关闭右上角 React Query Devtools（你看到的小红花来源）
- 修改文件：`LibreChat/client/src/App.jsx`

## Notes API 文档（当前实现）

路由前缀：`/api/notes`

### GET `/api/notes`

- 说明：获取当前用户的整棵笔记树
- Query（可选）：`conversationId`
- 返回：`{ notes: Note[] }`

### GET `/api/notes/:noteId`

- 说明：获取当前用户的单条笔记/文件夹
- 返回：`{ note: Note | null }`

### POST `/api/notes`

- 说明：创建笔记或文件夹
- Body 示例：

```json
{
  "type": "note",
  "title": "Untitled Note",
  "parentId": null,
  "content": "[]",
  "conversationId": "optional",
  "sortOrder": 0
}
```

- 返回：`{ note: Note }`

### PUT `/api/notes/:noteId`

- 说明：更新笔记/文件夹（标题、内容、父级、排序等）
- 返回：`{ note: Note }`

### PATCH `/api/notes/:noteId/move`

- 说明：移动节点（父级/排序）
- 返回：`{ note: Note }`

### DELETE `/api/notes/:noteId`

- 说明：删除节点
- 返回：`{ deleted: true }`

### POST `/api/notes/organize`

- 说明：AI 一键整理当前会话内容到笔记
- 行为：
  - 如果右侧当前选中的是 `note`，则把整理结果追加到该笔记
  - 如果右侧当前选中的是 `folder`，则在该文件夹下自动创建新笔记并写入整理结果
  - 如果当前没有选中任何笔记，则自动创建新笔记
- 整理方式：
  - 使用当前会话对应的 LLM endpoint 做一次单次 summary/completion 请求
  - 前端按钮在整理期间显示 loading spinner，避免无反馈等待
- Body 示例：

```json
{
  "conversationId": "current-conversation-id",
  "noteId": "optional-selected-note-or-folder-id"
}
```

- 返回：`{ organized: true, note: Note }`

### Note 数据结构

```ts
type Note = {
  _id: string;
  userId: string;
  parentId?: string | null;
  conversationId?: string;
  type: 'note' | 'folder';
  title: string;
  content: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};
```

## 权限与安全模型

- 所有 notes 查询均按 `req.user.id` 进行用户隔离
- 前端不决定资源归属，归属由后端认证上下文决定

## 本次主要改动文件

- `LibreChat/client/src/components/Chat/NotesPanel.tsx`
- `LibreChat/client/src/components/Chat/NotesPanel.css`
- `LibreChat/client/src/components/Chat/ChatView.tsx`
- `LibreChat/client/src/components/Chat/Header.tsx`
- `LibreChat/client/src/components/Chat/Presentation.tsx`
- `LibreChat/client/src/App.jsx`
- `LibreChat/client/src/data-provider/Notes.ts`
- `LibreChat/packages/data-provider/src/api-endpoints.ts`
- `LibreChat/packages/data-provider/src/data-service.ts`

## 项目代价（复杂度/工作量）

- 前端复杂度：中等（树组件交互、编辑器状态同步、自动保存、弹窗一致性）
- 后端复杂度：低到中等（以既有 notes CRUD 为主，用户隔离已建立）
- 维护代价：中等（BlockNote 二次定制与上传行为需持续验证）

## 当前已知事项

- 图片粘贴/上传链路已进入联调阶段，建议继续用真实会话做端到端验证
- Notes 的拖拽排序、导入导出、聊天一键写入笔记仍可作为下一阶段
- AI 一键整理笔记已接入 hover 操作，但仍建议继续做一次真实前后端联调，重点验证不同 endpoint 下的整理生成稳定性
- 笔记树节点操作区已调整到节点上方，避免长标题时删除/重命名按钮被挤掉

## 2026-03-29 Accepted Updates

### Learning Mode

- 修复了 `continue` 状态机与 `currentNodeId` 的同步问题：
  - 当前节点有多个可继续子节点时，进入 `awaitingBranchChoice`
  - 当前节点只有一个可继续子节点时，直接推进
  - 当前节点没有可继续子节点时，才回退到全局可学节点
- 重写了分支候选节点算法：
  - `Choose next branch` 改为展示所有绿色/已掌握节点的可学子节点
  - 增加去重、拓扑顺序稳定化、前置依赖过滤
- 学习状态持久化链路去掉了 `PUT` 成功后的立即 `invalidateQueries`，改为直接更新 query cache，避免 `GET /api/notes/learning-state` 持续重复触发

### AI Organize Note

- 聊天消息 hover 区新增 “AI 一键整理笔记” 入口
- 整理目标规则：
  - 右侧选中 `note` 时，追加写入该笔记
  - 右侧选中 `folder` 时，在该文件夹下自动创建新笔记
  - 未选中任何笔记时，自动创建根笔记
- 整理过程现在使用当前会话 endpoint/model 做单次 LLM summary/completion，请模型生成 markdown 笔记，不再是简单复制对话文本
- 前端整理按钮增加了 loading spinner，整理期间可见

### Notes Tree UX

- 修复长标题笔记/文件夹时操作按钮被挤掉的问题
- 删除、重命名按钮现在常显，并固定放在标题右侧
- 文件夹的“新建笔记”按钮也放在同一操作区，和删除/重命名并排显示

### Validation Notes

- `build:data-provider` 通过
- 学习模式针对性测试 `client/src/utils/learning.spec.ts` 通过
- 后端已重启并确认监听 `http://localhost:3080`

## 建议下一步

1. 固化图片上传与展示链路（粘贴、拖拽、手选文件三种入口统一）
2. 增加 notes API 的最小联调用例（创建/重命名/移动/删除）
3. 补充 `project/` 内的验收清单，作为后续 session 的回归基线
