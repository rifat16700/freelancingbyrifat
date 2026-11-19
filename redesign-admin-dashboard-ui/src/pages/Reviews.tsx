import { useMemo, useState } from "react";
import { Camera, Check, MessageSquareHeart, Star, Trash2, X } from "lucide-react";
import { useStore } from "../store";
import { Avatar, Badge, Button, Card, ConfirmButton, Empty, PageHeader, SearchBox, Select, Stat, Tabs, Thumb } from "../components/ui";
import { BarList } from "../components/charts";
import { ago, num } from "../lib/format";

const Stars = ({ n }: { n: number }) => <span className="inline-flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={14} className={i <= n ? "fill-amber-400 text-amber-400" : "text-slate-300"} />)}</span>;

export function Reviews() {
  const { reviews, products, t, toast, log, hasPerm } = useStore();
  const [tab, setTab] = useState<"all" | "pending" | "approved">("pending");
  const [rating, setRating] = useState("");
  const [q, setQ] = useState("");

  const canEdit = hasPerm("reviews", "edit");
  const canDelete = hasPerm("reviews", "delete");

  const pending = reviews.items.filter((r) => !r.approved);
  const approved = reviews.items.filter((r) => r.approved);
  const avg = approved.reduce((s, r) => s + r.rating, 0) / (approved.length || 1);
  const list = useMemo(() => reviews.items.filter((r) => (tab === "all" || (tab === "pending" ? !r.approved : r.approved)) && (!rating || r.rating === Number(rating)) && (!q || (r.text + r.name + (products.items.find((p) => p.id === r.productId)?.name || "")).toLowerCase().includes(q.toLowerCase()))), [reviews.items, tab, rating, q, products.items]);
  const approve = (id: string) => {
    if (!canEdit) return toast("Missing edit permission", "err");
    reviews.update(id, { approved: true });
    log("Review approved", id);
    toast("Review approved ✔");
  };

  return (
    <div>
      <PageHeader icon={<MessageSquareHeart size={22} />} title={t("Reviews", "রিভিউ")} desc="Approve what customers say about your products."
        actions={canEdit && pending.length > 0 ? <Button variant="primary" icon={<Check size={15} />} onClick={() => { reviews.set((a) => a.map((r) => ({ ...r, approved: true }))); toast(`${pending.length} reviews approved`); }}>Approve all {pending.length}</Button> : undefined} />
      <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1.3fr]">
        <Stat label="Average rating" value={avg.toFixed(2) + " ★"} sub={`${approved.length} approved`} icon={<Star size={20} />} tone="amber" />
        <Stat label="Waiting for you" value={pending.length} sub="approve fast to build trust" icon={<MessageSquareHeart size={20} />} tone="rose" goodUp={false} />
        <Stat label="With photos" value={num(reviews.items.filter((r) => r.hasPhoto).length)} sub="photo reviews convert more" icon={<Camera size={20} />} tone="violet" />
        <Card className="p-4"><div className="mb-2 text-xs font-medium text-slate-500">Rating breakdown</div><BarList fmt={num} color="#f59e0b" rows={[5, 4, 3, 2, 1].map((s) => ({ label: `${s} ★`, value: approved.filter((r) => r.rating === s).length }))} /></Card>
      </div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: "pending", label: "Pending", count: pending.length }, { id: "approved", label: "Approved", count: approved.length }, { id: "all", label: "All", count: reviews.items.length }]} />
        <div className="flex gap-2"><SearchBox value={q} onChange={setQ} placeholder="Search reviews…" className="sm:w-64" /><Select value={rating} onChange={(e) => setRating(e.target.value)} className="!w-36"><option value="">All ratings</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}</Select></div>
      </div>
      {list.length === 0 ? <Card><Empty title={tab === "pending" ? "All caught up 🎉" : "No reviews"} sub="New reviews will appear here." /></Card> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((r) => {
            const p = products.items.find((x) => x.id === r.productId);
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={r.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{r.name}</span><Stars n={r.rating} />{r.hasPhoto && <Badge tone="violet"><Camera size={11} />Photo</Badge>}{!r.approved && <Badge tone="amber">Pending</Badge>}<span className="ml-auto text-xs text-slate-400">{ago(r.date)}</span></div>
                    <p className="mt-1.5 text-sm text-slate-700">{r.text}</p>
                    {r.image && (
                      <a href={r.image} target="_blank" rel="noreferrer" className="mt-2 inline-block">
                        <img src={r.image} alt="Review" className="h-20 w-20 rounded-xl border border-slate-200 object-cover" />
                      </a>
                    )}
                    {p && <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-2"><Thumb p={p} size={30} /><span className="truncate text-xs font-medium text-slate-600">{p.name}</span></div>}
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-1.5">
                  {canEdit && !r.approved && <Button size="sm" variant="primary" icon={<Check size={14} />} onClick={() => approve(r.id)}>Approve</Button>}
                  {canEdit && r.approved && <Button size="sm" icon={<X size={14} />} onClick={() => { reviews.update(r.id, { approved: false }); toast("Moved back to pending"); }}>Unapprove</Button>}
                  {canDelete && <ConfirmButton onConfirm={() => { reviews.remove(r.id); toast("Review deleted"); }}><Trash2 size={15} /></ConfirmButton>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
