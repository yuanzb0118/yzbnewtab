# 变更：新增配置导出与导入功能

## 为什么

用户需要在多台电脑之间迁移相同的新标签页布局。当前所有个性化数据（桌面标签、时钟设置、搜索历史、自定义背景）仅存储在本地（chrome.storage.local 与 IndexedDB），无法跨设备迁移。

## 变更内容

- 在设置弹窗中新增"备份与恢复"区块，提供"导出配置"与"导入配置"入口
- 导出：收集 chrome.storage.local 全部配置与 IndexedDB 中的自定义背景图，生成单个 JSON 备份文件下载
- 导入：校验备份文件后覆盖本地配置与背景图，刷新页面使布局还原
- 图标缓存（IndexedDB iconCache）不参与备份，导入后按需重新生成

## 影响

- 受影响规范：new-tab-experience
- 受影响代码：index.html（设置弹窗 UI）、script.js（导出/导入逻辑）、styles.css（按钮样式）
