import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MATCH_STATUS_LABELS } from "@/types";
import type { MatchSummary } from "@/types";

export function AdminMatchesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MatchSummary | null>(null);
  const [form, setForm] = useState({
    event_id: "", team_a_id: "", team_b_id: "",
    format: "bo3", status: "scheduled", group_name: "", bracket_position: "",
    score_a: "", score_b: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "matches", page],
    queryFn: () => api.matches.list({ page: String(page), per_page: "20", sort: "created_at", order: "desc" }),
  });

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.admin.matches.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "matches"] }); setShowForm(false); resetForm(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.admin.matches.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "matches"] }); setShowForm(false); setEditing(null); resetForm(); },
  });

  const resetForm = () => {
    setForm({ event_id: "", team_a_id: "", team_b_id: "", format: "bo3", status: "scheduled", group_name: "", bracket_position: "", score_a: "", score_b: "" });
  };

  const handleEdit = (m: MatchSummary) => {
    setEditing(m);
    setForm({
      event_id: m.event_id, team_a_id: m.team_a_id, team_b_id: m.team_b_id,
      format: m.format, status: m.status, group_name: m.group_name ?? "",
      bracket_position: "", score_a: String(m.score_a ?? ""), score_b: String(m.score_b ?? ""),
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      const payload: Record<string, unknown> = {
        status: form.status,
        group_name: form.group_name || null,
        bracket_position: form.bracket_position || null,
      };
      if (form.score_a && form.score_b) {
        payload.score_a = Number(form.score_a);
        payload.score_b = Number(form.score_b);
      }
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate({
        event_id: form.event_id,
        team_a_id: form.team_a_id,
        team_b_id: form.team_b_id,
        format: form.format,
        group_name: form.group_name || null,
        bracket_position: form.bracket_position || null,
      });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">比赛管理</h1>
        <Button onClick={() => { setEditing(null); resetForm(); setShowForm(!showForm); }}>
          {showForm ? "取消" : "创建比赛"}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{editing ? "编辑比赛" : "创建比赛"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              {!editing && (
                <>
                  <Input placeholder="赛事ID" value={form.event_id} onChange={(e) => setForm({ ...form, event_id: e.target.value })} required />
                  <Input placeholder="队伍A ID" value={form.team_a_id} onChange={(e) => setForm({ ...form, team_a_id: e.target.value })} required />
                  <Input placeholder="队伍B ID" value={form.team_b_id} onChange={(e) => setForm({ ...form, team_b_id: e.target.value })} required />
                  <select
                    value={form.format}
                    onChange={(e) => setForm({ ...form, format: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="bo1">BO1</option>
                    <option value="bo3">BO3</option>
                    <option value="bo5">BO5</option>
                    <option value="bo7">BO7</option>
                  </select>
                  <Input placeholder="小组名称" value={form.group_name} onChange={(e) => setForm({ ...form, group_name: e.target.value })} />
                  <Input placeholder="淘汰赛位置" value={form.bracket_position} onChange={(e) => setForm({ ...form, bracket_position: e.target.value })} />
                </>
              )}
              {editing && (
                <>
                  <Input placeholder="比分A" type="number" value={form.score_a} onChange={(e) => setForm({ ...form, score_a: e.target.value })} />
                  <Input placeholder="比分B" type="number" value={form.score_b} onChange={(e) => setForm({ ...form, score_b: e.target.value })} />
                </>
              )}
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {Object.entries(MATCH_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {editing ? "保存修改" : "创建"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {data?.data.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{m.team_a_name} vs {m.team_b_name}</p>
                  <p className="text-sm text-muted-foreground">{m.event_name}{m.group_name ? ` - ${m.group_name}` : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono">{m.score_a != null ? `${m.score_a}:${m.score_b}` : "-:-"}</span>
                  <Badge variant="outline">{MATCH_STATUS_LABELS[m.status]}</Badge>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(m)}>编辑</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {data && data.total > 20 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
              <Button variant="outline" size="sm" disabled={page * 20 >= data.total} onClick={() => setPage((p) => p + 1)}>下一页</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
