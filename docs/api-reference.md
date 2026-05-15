# RM.tv API 参考

## 一、官方 CDN 数据源

**Base URL**: `https://rm-static.djicdn.com/live_json/`

### 1. `robot_data.json` — 战队与机器人

```json
{
  "zones": [{
    "zoneName": "南部赛区",
    "teams": [{
      "name": "队伍名",
      "collegeName": "大学名",
      "collegeLogo": "https://...",
      "robots": [{
        "type": "Infantry|Hero|Sapper|Airplane|Guard|Dart|Radar",
        "robotNumber": 1,
        "eaKDA": "0.5/1.5/0.3",
        "eagHurt": 1234.5,
        "gkDamage": 567.8,
        "eaExchangeEcon": 0,
        "gKillCount": 0,
        "etDartOutpostCnt": 0,
        "etDartFixedCnt": 0,
        "etDartRDMoveCnt": 0,
        "eaRadarMarkerTime": 0,
        "eaRadarParseSuccCnt": 0,
        "eaAssembleSuccCnt": 0,
        "eaBigHitRate": 0,
        "eaSmallHitRate": 0
      }]
    }]
  }]
}
```

KDA 格式: `"击杀/死亡/助攻"`

### 2. `group_rank_info.json` — 小组积分榜

```json
{
  "zones": [{
    "zoneName": "南部赛区",
    "groups": [{
      "groupName": "A组",
      "groupPlayers": [
        [
          { "itemValue": { "teamName": "队伍名" } },
          { "itemValue": "2/0/0" },
          { "itemValue": 6 }
        ]
      ]
    }]
  }]
}
```

- `groupPlayers[i][0]` = 队伍信息
- `groupPlayers[i][1]` = 记录 "胜/平/负"
- `groupPlayers[i][2]` = 净胜分

> 占位队伍 (A1, A2, B1 等) 需过滤。

### 3. `schedule.json` — 完整赛程

```json
{
  "data": {
    "event": {
      "zones": {
        "nodes": [{
          "id": "614",
          "matchDates": ["2026-05-13", "2026-05-14", ...],
          "groups": {
            "nodes": [{
              "name": "A",
              "players": {
                "nodes": [{
                  "id": "player_xxx",
                  "team": { "name": "队伍名", "collegeName": "大学", "collegeLogo": "..." },
                  "rank": 1
                }]
              }
            }]
          },
          "groupMatches": {
            "nodes": [{
              "id": "match_xxx",
              "groupId": "group_xxx",
              "orderNumber": 1,
              "planGameCount": 3,
              "planStartedAt": "2026-05-13T10:00:00+08:00",
              "status": "DONE|WAITING",
              "blueSide": { "player": { "team": { "name": "队伍A" } } },
              "redSide": { "player": { "team": { "name": "队伍B" } } },
              "blueSideWinGameCount": 2,
              "redSideWinGameCount": 1
            }]
          }
        }]
      }
    }
  }
}
```

> **关键**: 比分用 `WinGameCount`(局胜数)，不是 `SideScore`(局内小分)

### 4. `groups_order.json` — 分组与晋级

```json
{
  "data": {
    "event": {
      "zones": {
        "nodes": [{
          "id": "614",
          "groups": {
            "nodes": [{
              "name": "A",
              "players": {
                "nodes": [{
                  "team": { "name": "队伍名", "collegeName": "大学" },
                  "rank": 1,
                  "winGroupMatchCount": 2,
                  "loseGroupMatchCount": 0,
                  "groupMatchPointFor": 4,
                  "groupMatchPointAngist": 1
                }]
              }
            }]
          }
        }]
      }
    }
  }
}
```

### 5. `current_and_next_matches.json` — 实时状态

当前进行中和下一场比赛的实时数据。

### 机器人类型映射 (CDN → DB)

| CDN | DB enum | 中文 |
|-----|---------|------|
| Infantry | infantry | 步兵 |
| Hero | hero | 英雄 |
| Sapper | engineer | 工程 |
| Airplane | uav | 无人机 |
| Guard | sentinel | 哨兵 |
| Dart | dart | 飞镖 |
| Radar | radar | 雷达 |

### 赛区ID

| ID | 名称 |
|----|------|
| 614 | 南部赛区 |
| 615 | 东部赛区 |
| 616 | 北部赛区 |

---

## 二、本地 REST API

**Base**: `http://localhost:3000/api`

### 公共读取端点

#### 赛事 Events

```
GET /api/events
  参数: ?season=2026&status=ongoing&page=1&per_page=20
  返回: { data: Event[], total: number, page: number, per_page: number }

GET /api/events/:id
  返回: EventDetail { ...Event, stages: EventStage[], entries: EventEntry[] }
```

#### 比赛 Matches

```
GET /api/matches
  参数: ?event_id=&stage_id=&team_id=&status=&page=1&per_page=20
  返回: { data: MatchSummary[], total, page, per_page }

GET /api/matches/:id
  返回: MatchDetail { ...Match, team_a_name, team_b_name, maps[], participants[], robot_stats[], started_at, finished_at }
```

#### 战队 Teams

```
GET /api/teams
  参数: ?search=&page=1&per_page=24
  返回: { data: Team[], total, page, per_page }

GET /api/teams/:id
  返回: TeamDetail { ...Team, members: TeamMemberWithRoles[], robot_ratings: TeamRobotRating[] }
```

#### 排名 Rankings

```
GET /api/rankings
  参数: ?season=2026&page=1&per_page=50
  返回: { data: RankingEntry[], total, page, per_page }

GET /api/rankings/:team_id/history
  参数: ?season=2026
  返回: { data: TeamEloHistory[] }
```

#### 数据统计 Stats

```
GET /api/stats/robots
  参数: ?season=2026&robot_type=infantry&page=1&per_page=20&sort=rating&order=desc
  返回: { data: RobotRating[], total, page, per_page }
```

#### 阶段详情 Stages

```
GET /api/stages/:id/overview
  返回: StageOverview { stage_id, stage_name, stage_format, total_teams, standings[], rounds[] }
```

### 管理写入端点 (admin)

```
POST   /api/admin/events              # 创建赛事
PUT    /api/admin/events/:id          # 更新赛事
DELETE /api/admin/events/:id          # 删除赛事

POST   /api/admin/events/:id/stages   # 创建阶段

POST   /api/admin/matches             # 录入比赛 (触发Elo+Rating)
PUT    /api/admin/matches/:id         # 更新比赛

POST   /api/admin/teams               # 创建战队
PUT    /api/admin/teams/:id           # 更新战队
```

---

## 三、关键数据模型

### MatchSummary
```typescript
{
  id: string;
  event_id: string;
  event_name: string;
  team_a_id: string;
  team_a_name: string;
  team_b_id: string;
  team_b_name: string;
  score_a?: number;
  score_b?: number;
  format: string;           // "bo1"|"bo3"|"bo5"
  status: string;           // "scheduled"|"live"|"finished"
  scheduled_at?: string;    // ISO 8601
  group_name?: string;
}
```

### MatchDetail (extends MatchSummary)
```typescript
{
  // ...MatchSummary fields
  team_a_abbreviation?: string;
  team_b_abbreviation?: string;
  stage_id?: string;
  bracket_position?: string;
  round?: number;
  started_at?: string;
  finished_at?: string;
  maps: MatchMap[];              // 对局详情
  participants: MatchParticipant[];  // 上场队员
  robot_stats: MapRobotStats[];      // 机器人统计
}
```

### MatchMap
```typescript
{
  id: string;
  match_id: string;
  map_name: string;
  order_index: number;
  score_a?: number;
  score_b?: number;
  duration_seconds?: number;
}
```

### MapRobotStats
```typescript
{
  id: string;
  match_map_id: string;
  member_id: string;
  robot_type: string;
  kills: number;
  deaths: number;
  damage: number;
  hp_healed: number;
  base_damage: number;
  alive_time_seconds: number;
}
```

### RankingEntry
```typescript
{
  rank: number;
  team_id: string;
  team_name: string;
  team_abbreviation?: string;
  rating: number;           // Elo 分数
  matches_played: number;
}
```

### RobotRating
```typescript
{
  id: string;
  team_id: string;
  team_name: string;
  team_abbreviation?: string;
  member_id: string;
  robot_type: string;
  season: string;
  rating: number;
  matches_played: number;
}
```

### TeamDetail
```typescript
{
  // ...Team fields
  members: {
    id, team_id, name, role, avatar_url,
    joined_year, is_active,
    robot_roles: { id, member_id, robot_type, is_primary }[]
  }[];
  robot_ratings: { robot_type: string; rating?: number; matches_played?: number }[];
}
```

### StageOverview
```typescript
{
  stage_id: string;
  stage_name: string;
  stage_format: string;     // "swiss"|"round_robin"|"single_elim"|"double_elim"
  stage_type: string;       // "group"|"bracket"|"final"
  total_teams: number;
  total_matches: number;
  completed_matches: number;
  standings: {
    rank, team_id, team_name, team_abbreviation,
    wins, losses, draws, map_wins, map_losses, points,
    buchholz?, record: string
  }[];
  rounds: {
    round: number, label: string,
    matches: { match_id, team_a, team_b, score_a, score_b, status, scheduled_at }[]
  }[];
}
```

### PaginatedResponse\<T\>
```typescript
{ data: T[]; total: number; page: number; per_page: number; }
```

---

## 四、导入脚本

`scripts/import_rm_data.py` 执行 CDN → DB 全量同步:

```bash
# 从本地缓存读取 (默认)
python3 scripts/import_rm_data.py

# 强制刷新CDN数据
python3 scripts/import_rm_data.py --force

# 每日增量同步
bash scripts/scrape-daily.sh
```

### UUID 生成规则
```python
def stable_uuid(*parts):
    """MD5哈希 → UUID, 保证幂等"""
    s = "|".join(str(p) for p in parts)
    return str(uuid.UUID(hashlib.md5(s.encode()).hexdigest()))
```

### 评分算法

**Elo** (`scripts/compute_elo.py`):
- 公式: `E = 1/(1+10^((Rb-Ra)/400))`, `K ∈ {32,24,16}` 根据场次
- 初始值: 1500

**Robot Rating** (`scripts/import_rm_data.py` → `compute_robot_rating()`):
- 输入: kills, deaths, assists, damage, support, special
- 按兵种类型使用不同的权重和基线标准化
- 输出: ~0.3 – 1.7 (归一化值)
