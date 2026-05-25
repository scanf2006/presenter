# Release Notes | 发布说明

## Version | 版本信息

- Version | 版本: 0.3.194
- Build date | 构建日期: 2026-05-25
- Commit | 提交: 5690663

## Highlights | 版本亮点

- Projector stability hardening for display topology changes and fullscreen recovery.  
  针对显示拓扑变化和全屏恢复，增强了投影稳定性。
- Free text consistency improved across editor canvas, control preview, and projector output.  
  提升了自由文本在编辑画布、控制端预览和投影端之间的一致性。
- Commercial release pipeline introduced with one-command quality gate and CI workflow.  
  新增商业发布流程：一键质量闸门与 CI 自动校验。

## Fixed Issues | 修复问题

- Fixed occasional free text misalignment on projector (content jumping to corner positions).  
  修复了自由文本在投影端偶发偏移到角落的问题。
- Added emergency projector exit shortcut (`Ctrl+Shift+P`) for fullscreen/kiosk recovery.  
  新增紧急退出快捷键 `Ctrl+Shift+P`，可从全屏/Kiosk 模式快速恢复。
- Improved projector display re-binding fallback using last known valid display.  
  优化投影显示器重绑定回退策略，优先回退到上次有效显示器。
- Reduced editor/preview/projector text-wrap drift by unifying free text layout logic.  
  通过统一自由文本布局逻辑，减少编辑区/预览区/投影区换行漂移。

## Stability / Reliability | 稳定性与可靠性

- Projector behavior | 投影行为:
  - Added projector health monitor checks and stabilization flow.  
    增加投影健康监控与自动稳定流程。
  - Added display-event recovery safeguards and richer stabilization logging.  
    增加显示事件恢复保护，并补充更完整的稳定化日志。
- Free text consistency | 自由文本一致性:
  - Unified free text clamp/scale/width rules in shared utilities.  
    将自由文本的边界、缩放、宽度规则统一到共享工具。
  - Added regression tests for free text layout invariants.  
    新增自由文本布局不变量回归测试。
- Startup health | 启动健康检查:
  - Existing startup health checks retained; release checklist now requires explicit pass/fail recording.  
    保留现有启动健康检查，并要求在发布清单中显式记录通过/失败结果。

## Breaking Changes | 破坏性变更

- None.  
  无。

## Known Issues | 已知问题

- Build warns about large JS chunks (>500KB); non-blocking for this release.  
  构建存在 JS 包体积告警（>500KB），但不阻塞本次发布。
- Unsigned installer build is used in current output.  
  当前产物为未签名安装包。

## Validation Evidence | 验证证据

- `npm run -s commercial:gate`: PASS
- Commercial gate includes | 质量闸门包括:
  - lint PASS
  - test PASS (34/34)
  - build PASS
- External display projector test: recommended in clean-machine acceptance checklist.  
  外接显示器投影测试建议在“干净机验收清单”中执行并记录结果。

## Rollback | 回滚方案

- Previous baseline | 上一基线: commit `48073ee`（商业发布流水线与投影/文本重构之前）。
- Rollback steps | 回滚步骤:
  1. Checkout rollback commit/tag.  
     切换到回滚提交或标签。
  2. Rebuild unsigned installer: `npm run -s electron:build:unsigned`.  
     重新构建未签名安装包：`npm run -s electron:build:unsigned`。
  3. Reinstall previous package.  
     重新安装上一版本安装包。
