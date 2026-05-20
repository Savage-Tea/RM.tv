# RM.tv Rating 计算规则 v1.0

## 概述

Rating 是一个标准化的机器人表现评分，**均值 = 1.0**。原始 Rating 直接反映场均表现（所有输入数据均为 CDN 场均统计量），不做 Bayesian 收缩。

- Rating = 1.0 → 联盟平均水平
- Rating > 1.5 → 优秀
- Rating > 2.0 → 顶尖

## 数据来源

CDN `robot_data.json`（`https://rm-static.djicdn.com/live_json/robot_data.json`），按赛区×战队聚合的场均数据。

## 各兵种计算规则

### 步兵 (Infantry)

| 维度 | 权重 | CDN 字段 | Baseline |
|---|---|---|---|
| 战斗 (KDA) | 0.40 | `eaKDA` (K/D/A 格式) | 1.920 |
| 伤害 | 0.35 | `gkDamage` + `eagHurt` | 1043.56 |
| 支援 | 0.10 | `eaExchangeEcon` | 0.01 (near-zero → 1.0) |
| 精准 (命中率) | 0.15 | `eaBigHitRate` + `eaSmallHitRate` | 22.55 |

**公式：**
```
kda_raw = (kills + assists × 0.5) / max(deaths, 0.5)
norm_kda = kda_raw / 1.920
norm_dmg = damage / 1043.56
norm_spc = hit_rate / 22.55

rating = 0.40 × norm_kda + 0.35 × norm_dmg + 0.10 × 1.0 + 0.15 × norm_spc
```

---

### 英雄 (Hero)

英雄侧重远程伤害输出，KDA 权重降低。

| 维度 | 权重 | CDN 字段 | Baseline |
|---|---|---|---|
| 战斗 (KDA) | 0.25 | `eaKDA` | 0.428 |
| 伤害 | **0.55** | `gkDamage` + `eagHurt` | 424.72 |
| 支援 | 0.05 | `eaExchangeEcon` | 0.01 (→1.0) |
| 精准 | 0.15 | `eaBigHitRate` + `eaSmallHitRate` | 10.70 |

---

### 工程 (Engineer)

纯辅助，不参与战斗。核心指标：组装经济。

| 维度 | 权重 | CDN 字段 | Baseline |
|---|---|---|---|
| 组装经济 | **0.55** | `eaAssembleEcon` | 1377.49 |
| 组装成功 | 0.30 | `eaAssembleSuccCnt` | 1.65 |
| 组装难度 | 0.15 | `avgAssembleDiff` | 1.56 |

**公式：**
```
rating = 0.55 × (assemble_econ / 1377.49)
       + 0.30 × (assemble_succ / 1.65)
       + 0.15 × (assemble_diff / 1.56)
```

无数据时返回 1.0。

---

### 雷达 (Radar)

纯辅助，不参与战斗。核心指标：标记时长与情报解析。

| 维度 | 权重 | CDN 字段 | Baseline |
|---|---|---|---|
| 标记时间 | **0.50** | `eaRadarMarkerTime` | 417.61s |
| 反制时间 | 0.30 | `eaRadarCounterTime` | 38.55s |
| 解析成功 | 0.20 | `eaRadarParseSuccCnt` | 1.04 |

**公式：**
```
rating = 0.50 × (marker_time / 417.61)
       + 0.30 × (counter_time / 38.55)
       + 0.20 × (parse_succ / 1.04)
```

无数据时返回 1.0。若某维度值为 0（如无 counter_time），该维度归一化为 1.0。

---

### 飞镖 (Dart)

核心指标：命中靶位。高难度靶位加权。

| 靶位 | CDN 字段 | 难度系数 | 理由 |
|---|---|---|---|
| 前哨站 | `etDartOutpostCnt` | ×1.0 | 常规目标 |
| 固定靶 | `etDartFixedCnt` | ×1.0 | 常规目标 |
| 基地固定靶 | `etDartRDFixCnt` | ×2.0 | 需锁定基地 |
| **基地移动靶** | `etDartRDMoveCnt` | **×3.5** | 移动目标，技术难度大 |
| **末端移动靶** | `etDartEndMoveCnt` | **×5.0** | 高速末端移动，难度极大 |

**加权 special：**
```
special = outpost×1.0 + fixed×1.0 + rd_fix×2.0 + rd_move×3.5 + end_move×5.0
```

| 维度 | 权重 | Baseline |
|---|---|---|
| 战斗 (KDA) | 0.05 | 0.001 (→1.0) |
| 伤害 | 0.25 | 228.73 |
| 支援 | 0.05 | 0.01 (→1.0) |
| 精准 (靶位) | **0.60** | 3.62 (加权后联盟均值) |

---

### 哨兵 (Sentinel)

| 维度 | 权重 | CDN 字段 | Baseline |
|---|---|---|---|
| 战斗 (KDA) | 0.25 | `eaKDA` | 1.224 |
| 伤害 | 0.35 | `gkDamage` + `eagHurt` | 517.63 |
| 支援 | 0.10 | `eaExchangeEcon` | 0.01 (→1.0) |
| 击杀 | 0.30 | `gKillCount` | 0.61 |

---

### 无人机 (UAV)

| 维度 | 权重 | CDN 字段 | Baseline |
|---|---|---|---|
| 战斗 (KDA) | 0.30 | `eaKDA` | 2.021 |
| 伤害 | 0.30 | `gkDamage` + `eagHurt` | 1455.50 |
| 支援 | 0.20 | `eaExchangeEcon` | 0.01 (→1.0) |
| 精准 | 0.20 | `eaBigHitRate` + `eaSmallHitRate` | 11.44 |

---

## 通用规则

### 无数据降级
若 `damage < 0.1 && kills < 0.01`（该机器人类型无 KDA baseline 或为纯辅助），返回 1.0。

### 边界
- 原始 Rating clamp 到 [0.1, 5.0]
- 场均匹配次数从 CDN `schedule.json` 实际统计每队出场数

### 显示规则
- 0 场比赛 → 显示 1.0
- 1 场及以上 → 显示原始场均 Rating（不收缩）
