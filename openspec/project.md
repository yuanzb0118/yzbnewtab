# 项目 上下文

## 目的

YZB New Tab 是一个美观、极简的浏览器新标签页扩展程序，为用户提供个性化的浏览体验。主要功能包括：

- **时钟显示**：实时显示时间和日期，支持自定义颜色和秒数显示
- **搜索功能**：集成多个搜索引擎（Google、百度、Bing、GitHub）
- **书签管理**：侧边栏展示浏览器书签，支持搜索和快速添加到桌面
- **桌面快捷方式**：可自定义的网站快捷方式网格，支持拖拽排序、图标自定义和分页
- **背景自定义**：支持上传自定义背景图片，自动压缩优化，使用 IndexedDB 存储
- **毛玻璃效果**：iOS 风格的毛玻璃 UI 设计

## 技术栈

- **HTML5**：语义化标签结构
- **CSS3**：
  - CSS 变量用于主题配置
  - 毛玻璃效果（backdrop-filter）
  - Flexbox 和 Grid 布局
  - CSS 动画和过渡效果
- **原生 JavaScript (Vanilla JS)**：
  - ES6+ 特性（箭头函数、模板字符串、解构等）
  - 异步编程（Promise、async/await）
- **Chrome Extension API (Manifest V3)**：
  - chrome.storage.local（数据持久化）
  - chrome.bookmarks（书签访问）
- **IndexedDB**：存储自定义背景图片与网站图标 Blob 缓存
- **本地图标资源与 Chrome Favicon API**：
  - 扩展内 SVG（搜索引擎和常见品牌）
  - Chrome `/_favicon/`（其他网站图标）

## 项目约定

### 代码风格

1. **命名约定**：
   - 变量和函数使用驼峰命名法（camelCase）
   - 常量使用全大写下划线分隔（UPPER_SNAKE_CASE）
   - DOM 元素引用使用简化的 `$` 函数获取

2. **代码组织**：
   - 使用注释分区标记（如 `// ============ CLOCK ============`）
   - 相关功能代码集中在一起
   - 函数定义简洁明了，单一职责

3. **格式化**：
   - 使用 4 个空格缩进
   - 适当的空行分隔逻辑块
   - 代码注释使用中文

4. **CSS 类命名**：
   - 使用 kebab-case（如 `tag-item`、`glass`）
   - BEM 风格的变体（如 `icon-btn`, `close-btn`）

### 架构模式

1. **单页应用（SPA）**：
   - 所有功能在一个 HTML 页面中
   - 动态渲染和更新 UI

2. **事件驱动架构**：
   - 用户交互通过事件监听器处理
   - 事件委托用于动态元素

3. **存储策略**：
   - **优先级**：Chrome Storage API → IndexedDB → localStorage
   - Chrome Storage：用户偏好设置、桌面标签数据
   - IndexedDB：自定义背景图片和网站图标 Blob 缓存（避免 Chrome Storage 大小限制）
   - localStorage：开发环境回退方案

4. **数据流**：
   - 单向数据流（用户操作 → 更新数据 → 重新渲染）
   - 本地状态变量（如 `desktopTags`）作为单一数据源

5. **响应式设计**：
   - 使用媒体查询适配不同屏幕尺寸
   - 网格布局自适应

### 测试策略

当前项目**暂无自动化测试**，采用手动测试：

- 在 Chrome 浏览器中测试扩展功能
- 测试不同屏幕尺寸下的显示效果
- 验证数据持久化和迁移
- 手动测试边界情况（如大量标签、图片上传失败等）

**未来建议**：
- 添加单元测试框架（如 Jest）
- 集成 E2E 测试（如 Playwright）
- 设置 CI/CD 流水线

### Git工作流

1. **分支策略**：
   - `main`：主分支，稳定版本
   - 功能开发可以在本地分支进行

2. **提交约定**：
   - 使用语义化提交信息
   - 格式：`<类型>: <简短描述>`
   - 类型示例：
     - `feat`: 新功能
     - `fix`: 修复 bug
     - `refactor`: 重构代码
     - `style`: 样式调整
     - `docs`: 文档更新
   - 提交信息使用中文

3. **最近提交示例**：
   - `feat: add icon picker for bookmark customization`
   - `feat: iOS-style new tab page with drag-drop bookmarks`

## 领域上下文

1. **浏览器扩展开发**：
   - Manifest V3 规范要求
   - 权限管理（storage、bookmarks）
   - Chrome API 的异步特性

2. **UI/UX 设计**：
   - iOS 风格的毛玻璃效果（glassmorphism）
   - 流畅的动画和过渡效果
   - 直观的拖拽交互
   - 右键上下文菜单

3. **图标处理**：
   - 常见品牌优先使用扩展内 SVG
   - 其他网站使用 Chrome favicon 并持久缓存到 IndexedDB
   - SVG data URL 用于自定义彩色图标
   - 图标加载失败时的降级策略

4. **性能优化**：
   - 图片上传前自动压缩（WebP 格式，最大 4K 分辨率）
   - 懒加载和按需渲染
   - 避免不必要的 DOM 操作

## 重要约束

1. **技术约束**：
   - 必须兼容 Chrome Extension Manifest V3
   - 不使用外部框架（React、Vue 等），保持轻量级
   - 文件大小需要考虑（扩展包大小限制）

2. **兼容性约束**：
   - 主要针对 Chrome/Chromium 浏览器
   - 需要支持现代浏览器特性（CSS Grid、backdrop-filter 等）

3. **存储约束**：
   - Chrome Storage 有大小限制（通常 10MB）
   - IndexedDB 用于自定义背景和网站图标缓存
   - localStorage 作为开发环境的回退方案

4. **用户体验约束**：
   - 响应速度要求高（新标签页加载时间）
   - 离线可用性（部分功能）
   - 视觉美观度要求高

5. **业务约束**：
   - 个人项目，无商业目标
   - 保持代码简洁可维护
   - 中文用户为主

## 外部依赖

1. **默认运行时资源**：
   - 系统字体栈
   - 扩展内品牌 SVG
   - Chrome 官方 favicon 接口，不访问第三方 favicon 服务

2. **浏览器 API**：
   - `chrome.storage.local`：数据存储
   - `chrome.bookmarks`：书签访问
   - `chrome.runtime.getURL('/_favicon/')`：读取 Chrome favicon 数据库

3. **Web 标准 API**：
   - **IndexedDB**：背景图片和网站图标 Blob 存储
   - **File API**：文件上传处理
   - **Canvas API**：图片压缩处理

4. **依赖风险**：
   - Chrome favicon 数据库可能只有低分辨率图标，因此使用 128px 请求、IndexedDB 缓存和本地矢量图标兜底
   - 用户主动填写的外部图标仍可能受网络和 CORS 限制
   - 浏览器 API 兼容性
