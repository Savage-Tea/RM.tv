# RM.tv 运维指南

## 启动服务

```bash
# 后端 (Rust, port 3000)
cd backend
cargo run

# 前端 (Vite, port 5173)
cd frontend
npm run dev
```

## 数据导入

### CDN 数据爬取

```bash
cd scripts
python3 import_rm_data.py --force
```

导入流程：
1. 从 `rm-static.djicdn.com` 拉取 `schedule.json` / `robot_data.json`
2. 创建 Event → Stages → Matches → Entries
3. 同步 Teams（name/university/logo）

### Rating 重算

当 Rating 公式修改后，需重算所有数据：

```bash
python3 scripts/compute_ratings.py
```

该脚本从 CDN 重新拉取 `robot_data.json` 和 `schedule.json`，重算 672 条 rating 并写入 DB。

## 数据库

- **地址**: `localhost:5432`
- **数据库**: `rmtv`
- **用户**: `rmtv` / `rmtv_dev`

### 备份

```bash
pg_dump -h localhost -U rmtv rmtv > rmtv_backup_$(date +%Y%m%d).sql
```

### 恢复

```bash
psql -h localhost -U rmtv rmtv < rmtv_backup_YYYYMMDD.sql
```

## 目录结构

```
RM.tv/
├── backend/             # Rust axum API
│   ├── src/
│   │   ├── routes/      # API 路由
│   │   ├── services/    # 业务逻辑
│   │   ├── models/      # 数据模型
│   │   └── migrations/  # SQL 迁移
│   └── Cargo.toml
├── frontend/            # React + Vite
│   └── src/
│       ├── routes/       # 页面组件
│       ├── components/   # 可复用组件
│       ├── lib/          # API 客户端 + 布局算法
│       └── types/        # TypeScript 类型
├── scripts/             # 数据导入 + 维护脚本
│   ├── import_rm_data.py
│   └── compute_ratings.py
└── docs/                # 文档
    ├── rating_v1.0.md   # Rating 计算规则
    ├── sql_notes.md     # SQL 参考
    └── maintenance.md   # 本文件
```

## CDN 数据更新周期

- **赛前**: `schedule.json` 更新赛程（matchDates + 所有 matches 以 `status: READY` 状态出现）
- **赛中**: 赛后数小时内更新 match 状态为 `DONE`，同时更新 `robot_data.json` 场均数据
- **赛后**: 赛区数据在下一赛区开始后可能从 CDN 移除；建议在赛区结束后立即爬取

### 2026 赛程

| 赛区 | 日期 | 状态 |
|---|---|---|
| 南部赛区 | 05-13 ~ 05-17 | 已完成 ✓ |
| 东部赛区 | 05-21 ~ 05-25 | 即将开始 |
| 北部赛区 | 05-29 ~ 06-02 | 未开始 |

## 常见问题

### 后端 500 错误

```bash
tail -50 /tmp/rmtv-backend.log | grep ERROR
```

常见原因：SQL 列名不匹配（新增字段后忘记更新所有查询）。

### 前端白屏

1. 检查 `npx tsc --noEmit` 是否有类型错误
2. 检查浏览器 Console 的 JS 错误
3. 检查 API 是否可达：`curl http://localhost:3000/api/events`

### Rating 异常

1. 确认 CDN 数据是否最新：`curl https://rm-static.djicdn.com/live_json/schedule.json | python3 -m json.tool | head`
2. 手动重算：`python3 scripts/compute_ratings.py`
3. 检查 `robot_rating` 表：`SELECT robot_type, AVG(rating::float8) FROM robot_rating WHERE season='2026' GROUP BY robot_type;`
