# ChurchDisplay Pro 产品需求文档 (PRD) / Product Requirements Document

## 1. 产品目标 / Product Goals
- 为教会聚会提供稳定、易用的投影控制系统。  
  Provide a stable and easy-to-use projection control system for church services.
- 支持歌曲、经文、自由文字、图片、视频、PDF、PPT 的统一编排与投屏。  
  Support unified management and projection for songs, Bible verses, free text, images, videos, PDF, and PPT.
- 在双屏、分辨率差异、缩放差异场景下保持可预测的全屏投影。  
  Keep fullscreen projection predictable across dual-display, resolution, and scaling differences.

## 2. 核心用户与场景 / Core Users and Scenarios
- 核心用户：投影同工、敬拜团队、讲员支持同工。  
  Core users: projection operators, worship team members, and speaker support staff.
- 场景：会前准备、会中快速切换、扩展屏直投、OBS/NDI 联动。  
  Scenarios: pre-service prep, in-service fast switching, extended-display projection, OBS/NDI integration.

## 3. 功能范围 / Functional Scope
1. 内容管理 / Content Management
- 歌曲库增删改查、歌词导入、背景管理。  
  Song CRUD, lyrics import, and background management.
- 圣经章节检索、经文投影与排队。  
  Bible chapter/verse lookup, projection, and queueing.
- 媒体导入与播放（图片/视频/PDF/PPT/YouTube）。  
  Media import and playback (image/video/PDF/PPT/YouTube).

2. 投影控制 / Projection Control
- 外接显示器选择、启动/停止投影。  
  External display selection and projector start/stop.
- 预览窗口与投影输出同步。  
  Preview window synchronized with projector output.
- 淡入淡出与黑场控制。  
  Fade transitions and blackout control.

3. 队列系统 / Queue System
- 队列增删改查、重命名、拖拽排序、清空确认。  
  Queue add/edit/delete, rename, drag reorder, and clear confirmation.
- 按内容类型保存必要状态（背景、字体、节号、页码等）。  
  Persist required per-item state by type (background, font, verse/page state, etc.).

4. 集成能力 / Integrations
- NDI 输出（供 OBS/vMix 等接收）。  
  NDI output for OBS/vMix and similar tools.
- 安装包发布与离线运行支持。  
  Installer-based distribution with offline operation support.

## 4. 非功能要求 / Non-Functional Requirements
- 稳定性：Windows 常见双屏与混合 DPI 下保持全屏覆盖，不露桌面。  
  Stability: ensure fullscreen coverage on common Windows dual-display and mixed-DPI setups.
- 可维护性：关键流程模块化（窗口、队列、投影分发、IPC）。  
  Maintainability: modularize key flows (windowing, queue, projection dispatch, IPC).
- 可用性：高风险操作需确认；支持鼠标与键盘主流程操作。  
  Usability: confirm high-risk actions; support both mouse and keyboard primary workflows.

## 5. 发布与版本规则 / Release and Versioning Rules
1. 每次升级必须更新版本号。  
   Every user-facing upgrade must bump the app version.
2. 默认规则：功能修复（bug fix）与版本升级都必须修改版本号。  
   Default rule: both bug fixes and feature/version upgrades must bump the app version.
3. 安装包文件名版本必须与 `package.json` 一致。  
   Installer filename version must match `package.json`.
4. 发布需可追踪核心改动与风险。  
   Each release must keep traceable change/risk notes.

## 6. 文档规范 / Documentation Rules
1. 所有项目文档采用中英文双语。  
   All project docs must be bilingual (Chinese and English).
2. 新增或更新文档时，中英文内容需同步维护。  
   Chinese and English content must be updated in sync.

## 7. 验收标准（简版） / Acceptance Criteria (Lite)
- 核心内容类型可正常投影。  
  Core content types can be projected correctly.
- 队列播放与手动切换行为一致且可预测。  
  Queue playback and manual switching are consistent and predictable.
- 双屏投影覆盖完整，切换后不露桌面。  
  Dual-display projection fully covers target screen without exposing desktop.
- 可成功输出安装包，版本号正确。  
  Installer is generated successfully with correct versioning.

## 8. 协作执行约定 / Collaboration Execution Rules
1. 用户在沟通中提出的产品、发布、构建、调试要求，默认要记录到本 PRD。  
   Product/release/build/debug requirements raised by the user must be documented in this PRD by default.
2. 若规则冲突，以用户最新明确指令为准，并覆盖旧规则。  
   If requirements conflict, the latest explicit user instruction overrides previous rules.
3. 默认打包英文包，默认调试英文版本；仅在用户明确要求时打中文包。  
   Default packaging and debugging target is English; produce Chinese package only when explicitly requested by the user.

## 9. 历史需求归档（长期有效） / Historical Requirements Archive (Long-lived)
1. 打包与发布 / Packaging and Release
- 默认执行英文构建与英文调试；仅在明确要求时执行中文构建。  
  Default target is English build/debug; switch to Chinese build only when explicitly requested.
- 面向用户的任何改动（功能或修复）打包前必须升级版本号。  
  Every user-facing feature or fix requires a version bump before packaging.
- 构建应避免把 `dist/win-unpacked` 等临时产物再次卷入 `app.asar`。  
  Packaging must avoid re-bundling generated output directories into `app.asar`.
- 交付时必须给出明确安装包路径。  
  Release handoff must include exact installer artifact path.

2. 投影与显示稳定性 / Projection and Display Stability
- 扩展屏直投必须完整覆盖目标屏，不露桌面、任务栏或控制界面。  
  Extended-display projection must fully cover target display without exposing desktop/taskbar/control UI.
- 混合 DPI/分辨率场景下保持全屏稳定，避免窗口错位和尺寸漂移。  
  Keep fullscreen stable under mixed DPI/resolution topologies.
- 预览框与实际投影应尽量一致，差异需可解释并可配置。  
  Preview and projected output should remain aligned; differences must be explainable/configurable.

3. OBS/NDI 协作 / OBS and NDI Interop
- NDI 输出作为一等能力，界面应能显示可用状态与接收端数量。  
  NDI output is first-class and should expose availability and receiver count in UI.
- OBS 模式不应把控制界面误作为主输出。  
  OBS mode must not accidentally expose the control UI as primary output content.
- 在不可投影状态下，相关模式应有清晰启用限制与低噪声提示。  
  In non-projecting state, related mode gating and low-noise messaging are required.

4. 队列与交互 / Queue and Interaction
- `Del Selected`、`Clear Queue` 等高风险动作必须确认。  
  High-risk actions such as `Del Selected` and `Clear Queue` require confirmation.
- 队列选中态要明显，键盘焦点与选中状态应同步。  
  Queue selection must be visually clear, with keyboard focus aligned to selected state.
- 列表边界键盘导航需自然截止，避免跳转到无关界面。  
  Keyboard navigation must clamp at list boundaries and avoid unintended section jumps.
- 拖拽重排提示与实际重排结果必须一致。  
  Drag-reorder indication must match actual reorder outcome.

5. 内容一致性行为 / Content Consistency Rules
- 歌曲、经文、PPT/PDF 等在队列中的点击/投影语义应一致且可预期。  
  Click-to-select/project semantics across songs, Bible, PPT/PDF queue entries must be consistent.
- 与背景类似，歌曲样式（字体/大小/颜色）按歌曲或队列项独立保存，不串改。  
  Song style state must persist per song or queue item (no global leakage).
- Free Text 视图不能被上一个媒体详情页残留状态污染。  
  Free Text editor state must not be polluted by prior media-detail views.

6. 媒体导入与解析 / Media Import and Parsing
- 拖拽导入在主进程安全校验链路中必须可用，不可静默失败。  
  Drag-and-drop import must pass secure main-process approval flow and never fail silently.
- 队列中打开 PDF/PPT 详情时要减少误关风险（必要时隐藏 close）。  
  PDF/PPT detail opened from queue should reduce accidental-close risk.
- 歌词网站搜索/导入优先稳定来源与可解析路径，屏蔽不相关镜像噪声。  
  Lyrics site search/import should prioritize stable parseable sources and filter noisy mirrors.

7. 本地化与文档维护 / Localization and Documentation Maintenance
- 核心页面与核心 toast/alert 应完整支持中英双语。  
  Core pages and user-facing toasts/alerts should support bilingual localization.
- 新增规则需持续追加到 PRD，作为后续执行基线。  
  Newly confirmed rules should be continuously appended into PRD as execution baseline.

8. 代码维护原则 / Code Maintenance Principles
- 优先最小且安全的修复，避免在热修复里夹带无关重构。  
  Prefer minimal safe fixes; avoid unrelated refactors in hotfix scope.
- 临时诊断与自检代码在发布前应清理。  
  Temporary diagnostics/self-check code must be removed before release builds.
