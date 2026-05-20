# SQL 参考

## 数据库连接

```bash
psql -h localhost -U rmtv -d rmtv
# password: rmtv_dev
```

## 常用查询

### 赛事概览

```sql
SELECT e.name, e.season, e.status,
       COUNT(DISTINCT es.id) AS stages,
       COUNT(DISTINCT m.id) AS matches
FROM events e
LEFT JOIN event_stages es ON es.event_id = e.id
LEFT JOIN matches m ON m.event_id = e.id
GROUP BY e.id
ORDER BY e.season DESC;
```

### 赛区比赛数

```sql
SELECT es.name, es.stage_format::text, es.stage_type::text,
       COUNT(m.id) AS matches,
       COUNT(m.id) FILTER (WHERE m.status = 'finished') AS done
FROM event_stages es
LEFT JOIN matches m ON m.stage_id = es.id
WHERE es.event_id = (SELECT id FROM events WHERE season = '2026')
GROUP BY es.id, es.name, es.stage_format, es.stage_type
ORDER BY es.order_index;
```

### 战队 Rating 排行榜

```sql
SELECT t.name, t.university,
       rr.robot_type::text,
       ROUND(rr.rating::numeric, 2) AS rating,
       rr.matches_played
FROM robot_rating rr
JOIN teams t ON t.id = rr.team_id
WHERE rr.season = '2026' AND rr.robot_type = 'dart'
ORDER BY rr.rating::float8 DESC
LIMIT 10;
```

### 查找无比赛数据的战队

```sql
SELECT DISTINCT t.name, t.university
FROM teams t
JOIN robot_rating rr ON rr.team_id = t.id
WHERE rr.season = '2026' AND rr.matches_played = 0;
```

### 清理特定 stage 的比赛

```sql
DELETE FROM matches WHERE stage_id = '<uuid>';
-- cascades to match_maps, match_participants, map_robot_stats
```

### 合并 stage 的比赛到另一个 stage

```sql
UPDATE matches SET stage_id = '<target_uuid>', round = <new_round>
WHERE stage_id = '<source_uuid>';
```

## 表结构要点

| 表 | 关键约束 |
|---|---|
| `matches` | `team_a_id`, `team_b_id` REFERENCES `teams(id) ON DELETE CASCADE` |
| `match_maps` | `match_id` REFERENCES `matches(id) ON DELETE CASCADE` |
| `robot_rating` | `UNIQUE(member_id, robot_type, season)` |
| `event_entries` | `UNIQUE(event_id, team_id)` |
| `event_stage_progression` | `UNIQUE(from_stage_id, to_stage_id)` |

## 迁移

```bash
cd backend
sqlx migrate run    # 执行未应用的迁移
sqlx migrate revert # 回滚最近一次迁移
```
