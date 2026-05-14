import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EVENT_STATUS_LABELS } from "@/types";
import type { Event } from "@/types";

export function AdminEventsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState({
    name: "", series: "", season: "", start_date: "", end_date: "", location: "", status: "upcoming",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "events", page],
    queryFn: () => api.events.list({ page: String(page), per_page: "20" }),
  });

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.admin.events.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "events"] }); setShowForm(false); resetForm(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.admin.events.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "events"] }); setShowForm(false); setEditing(null); resetForm(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.admin.events.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "events"] }),
  });

  const resetForm = () => {
    setForm({ name: "", series: "", season: "", start_date: "", end_date: "", location: "", status: "upcoming" });
  };

  const handleEdit = (e: Event) => {
    setEditing(e);
    setForm({
      name: e.name, series: e.series, season: e.season,
      start_date: e.start_date ?? "", end_date: e.end_date ?? "",
      location: e.location ?? "", status: e.status,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      location: form.location || null,
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">赛事管理</h1>
        <Button onClick={() => { setEditing(null); resetForm(); setShowForm(!showForm); }}>
          {showForm ? "取消" : "创建赛事"}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{editing ? "编辑赛事" : "创建赛事"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <Input placeholder="赛事名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input placeholder="系列" value={form.series} onChange={(e) => setForm({ ...form, series: e.target.value })} required />
              <Input placeholder="赛季" value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} required />
              <Input placeholder="地点" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <Input type="date" placeholder="开始日期" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              <Input type="date" placeholder="结束日期" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {Object.entries(EVENT_STATUS_LABELS).map(([k, v]) => (
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
          {data?.data.map((event) => (
            <Card key={event.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{event.name}</p>
                  <p className="text-sm text-muted-foreground">{event.series} - {event.season}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{EVENT_STATUS_LABELS[event.status]}</Badge>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(event)}>编辑</Button>
                  <Button variant="destructive" size="sm" onClick={() => { if (confirm("确认删除？")) deleteMut.mutate(event.id); }}>删除</Button>
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
