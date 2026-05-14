import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Team } from "@/types";

export function AdminTeamsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [form, setForm] = useState({
    name: "", name_en: "", university: "", abbreviation: "",
    founded_year: "", description: "", logo_url: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "teams", page, search],
    queryFn: () => api.teams.list({ page: String(page), per_page: "20", search }),
  });

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.admin.teams.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "teams"] }); setShowForm(false); resetForm(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.admin.teams.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "teams"] }); setShowForm(false); setEditing(null); resetForm(); },
  });

  const resetForm = () => {
    setForm({ name: "", name_en: "", university: "", abbreviation: "", founded_year: "", description: "", logo_url: "" });
  };

  const handleEdit = (t: Team) => {
    setEditing(t);
    setForm({
      name: t.name, name_en: t.name_en ?? "", university: t.university,
      abbreviation: t.abbreviation ?? "", founded_year: t.founded_year ? String(t.founded_year) : "",
      description: t.description ?? "", logo_url: t.logo_url ?? "",
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      name: form.name,
      name_en: form.name_en || null,
      university: form.university,
      abbreviation: form.abbreviation || null,
      founded_year: form.founded_year ? Number(form.founded_year) : null,
      description: form.description || null,
      logo_url: form.logo_url || null,
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
        <h1 className="text-2xl font-bold">战队管理</h1>
        <Button onClick={() => { setEditing(null); resetForm(); setShowForm(!showForm); }}>
          {showForm ? "取消" : "创建战队"}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{editing ? "编辑战队" : "创建战队"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <Input placeholder="战队名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input placeholder="英文名称" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
              <Input placeholder="所属大学" value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} required />
              <Input placeholder="缩写" value={form.abbreviation} onChange={(e) => setForm({ ...form, abbreviation: e.target.value })} />
              <Input placeholder="成立年份" type="number" value={form.founded_year} onChange={(e) => setForm({ ...form, founded_year: e.target.value })} />
              <Input placeholder="Logo URL" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
              <Input placeholder="描述" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {editing ? "保存修改" : "创建"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="mb-4">
        <Input placeholder="搜索战队..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {data?.data.map((team) => (
            <Card key={team.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{team.name}{team.name_en ? ` (${team.name_en})` : ""}</p>
                  <p className="text-sm text-muted-foreground">{team.university}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleEdit(team)}>编辑</Button>
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
