# RM.tv —— RoboMaster 数据统计平台

受 [HLTV.org](https://hltv.org) 启发，为全国大学生机器人比赛 RoboMaster 提供赛事数据、战队信息、比赛记录和瑞士轮/淘汰赛可视化。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite + TanStack Router + TanStack Query + Tailwind CSS |
| 后端 | Rust (axum 0.7) + SQLx + PostgreSQL |
| 数据 | CDN 爬取 (rm-static.djicdn.com) + Python 导入脚本 |

## 已实现功能

### 赛事页面 `/events/$eventId`
- 赛事基础信息展示（名称、时间、地点、状态）
- 阶段导航（瑞士轮小组赛 → 淘汰赛 → 全国赛名额争夺）
- 瑞士轮 bracket 可视化（按战绩分列，5 轮 + 最终结果栏）
- 单败淘汰赛 bracket 可视化（16 进 8 → 8 进 4 → 半决赛 → 决赛 + 8 强结果）
- 积分榜（非瑞士轮阶段）
- 参赛战队列表（按选中阶段自动过滤）

### 比赛列表 `/matches`
- 筛选：赛季、阶段类型、状态、关键词搜索
- 排序：时间正序/倒序
- 分页
- 显示：队徽、学校、比分/时间、所处阶段、赛制

### 比赛详情 `/matches/$matchId`
- 对战双方信息（队徽、队名、学校）
- 比分展示（胜者高亮）
- 对局详情（Map-by-map 数据）
- 数据统计（击杀、死亡、伤害、治疗、基地伤害）
- 赛事信息

### 战队列表 `/teams` & 战队详情 `/teams/$teamId`
- 战队搜索/浏览
- 机器人 Rating 数据（英雄、步兵、哨兵、工程、无人机、飞镖、雷达）
- 近期比赛记录

### 数据统计 `/stats`
- 机器人 Rating 排行榜
- 按机器人类型筛选

### 管理后台 `/admin`
- 比赛、战队、赛事数据的 CRUD 操作

## 数据来源

2026 赛季数据来自大疆官方 CDN (`rm-static.djicdn.com`)：
- 南部赛区（2026-05-13 ~ 05-17）：瑞士轮小组赛 + 淘汰赛 + 全国赛名额争夺
- 东部赛区（2026-05-21 ~ 05-25）
- 北部赛区（2026-05-29 ~ 06-02）

## 本地运行

```bash
# 后端
cd backend
cargo run

# 前端
cd frontend
npm run dev
```

- 前端：`http://localhost:5173`
- 后端 API：`http://localhost:3000`
- 数据库：PostgreSQL `rmtv` @ `localhost:5432`

## 项目结构

```
RM.tv/
├── backend/
│   ├── src/
│   │   ├── routes/        # API 路由
│   │   ├── services/      # 业务逻辑（match_service, stage_service, team_service, rating_service）
│   │   ├── models/        # 数据模型
│   │   ├── datasource/    # 数据源配置
│   │   └── error.rs       # 错误处理
│   └── migrations/        # 数据库迁移
├── frontend/
│   ├── src/
│   │   ├── routes/        # 页面组件
│   │   ├── components/    # 可复用组件
│   │   │   └── events/    # SwissBracket, StageMatches, StandingsTable
│   │   ├── lib/           # API 客户端、布局算法 (swiss-bracket.ts)
│   │   └── types/         # TypeScript 类型定义
│   └── index.css          # 全局样式 + Tailwind
└── scripts/
    └── import_rm_data.py  # CDN 数据导入脚本
```
