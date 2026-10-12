import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExerciseGuide } from "@/components/ExerciseGuide";
import { fetchCoachSessions, fetchSessionItems, ownSessions, totalMinutes } from "@/lib/coach-sessions";
import { fetchCoachDrills } from "@/lib/coach-drills";
import { fetchDrills, fetchTrainingSessions, fetchTacticCards, type EventResourceKind } from "@/lib/taktikbank";
import { drillGuide, type ExerciseGuideData } from "@/lib/training-outcomes";
import { drillDefaultMinutes } from "@/lib/drill-duration";

export type TrainingContentChoice = {
  kind: EventResourceKind;
  resourceId: string;
  title: string;
  minutes: number | null;
  details: ExerciseGuideData;
};
type Preview = TrainingContentChoice & {
  ownSession?: boolean;
  summary?: string | null;
  blocks?: { title: string; minutes: number; note?: string | null; details?: ExerciseGuideData }[];
};

export function TrainingContentPicker({ open, onOpenChange, userId, onSelect, pending = false, includeTactics = false }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  onSelect: (choice: TrainingContentChoice) => void;
  pending?: boolean;
  includeTactics?: boolean;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [category, setCategory] = useState("Mina träningspass");
  const [query, setQuery] = useState("");
  const sessions = useQuery({ queryKey: ["coach-sessions"], queryFn: fetchCoachSessions, enabled: open });
  const bank = useQuery({ queryKey: ["tb-sessions"], queryFn: fetchTrainingSessions, enabled: open });
  const drills = useQuery({ queryKey: ["tb-drills"], queryFn: fetchDrills, enabled: open });
  const own = useQuery({ queryKey: ["coach-drills"], queryFn: fetchCoachDrills, enabled: open });
  const tactics = useQuery({ queryKey: ["tb-tactics"], queryFn: fetchTacticCards, enabled: open && includeTactics });
  const parts = useQuery({ queryKey: ["coach-session-items", preview?.resourceId], queryFn: () => fetchSessionItems(preview?.resourceId ?? ""), enabled: open && Boolean(preview?.ownSession) });
  const groups: Record<string, Preview[]> = {
    "Mina träningspass": ownSessions(sessions.data ?? [], userId).map((row) => ({ kind: "session", resourceId: row.id, title: row.title, minutes: null, details: {}, ownSession: true, summary: [row.goal, row.theme, row.notes].filter(Boolean).join(" · ") })),
    "Träningspass ur banken": (bank.data ?? []).map((row) => ({ kind: "session", resourceId: row.id, title: row.title, minutes: row.total_minutes, details: {}, summary: row.theme, blocks: [...row.data.blocks].sort((a, b) => a.order - b.order).map((block) => ({ title: block.activity, minutes: block.minutes, note: block.focus ?? null })) })),
    "Övningar": [
      ...(own.data ?? []).filter((row) => row.in_library).map((row): Preview => ({ kind: "drill", resourceId: row.id, title: row.title, minutes: row.minutes, details: { ...row.guide, purpose: row.guide?.purpose ?? row.purpose ?? undefined, execution: row.guide?.execution?.length ? row.guide.execution : row.instruction ? [row.instruction] : undefined, equipment: row.guide?.equipment?.length ? row.guide.equipment : row.equipment?.split(",") }, summary: row.coach_focus })),
      ...(drills.data ?? []).map((row): Preview => ({ kind: "drill", resourceId: row.id, title: row.title, minutes: drillDefaultMinutes(row), details: drillGuide(row) })),
    ],
    ...(includeTactics ? { "Taktikkort": (tactics.data ?? []).map((row): Preview => ({ kind: "tactic", resourceId: row.id, title: row.title, minutes: null, details: { purpose: row.purpose ?? undefined, execution: row.data.roleActions?.map((item) => item.action), coachingPoints: [row.data.childCue, row.data.coachQuestion].filter((item): item is string => Boolean(item)) } })) } : {}),
  };
  const activeQuery = category === "Mina träningspass" ? sessions : category === "Träningspass ur banken" ? bank : category === "Taktikkort" ? tactics : drills;
  const failed = activeQuery.isError || (category === "Övningar" && own.isError);
  const loading = activeQuery.isPending || (category === "Övningar" && own.isPending);
  const blocks = preview?.ownSession ? (parts.data ?? []).map((item) => ({ title: item.title, minutes: item.minutes, note: item.note, details: item.details })) : preview?.blocks;
  const minutes = preview?.ownSession ? totalMinutes(parts.data ?? []) : preview?.minutes;
  const previewReady = !preview?.ownSession || parts.isSuccess;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (pending) return; onOpenChange(next); if (!next) setPreview(null); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{preview ? preview.title : "Koppla innehåll till träningen"}</DialogTitle></DialogHeader>
        {preview ? (
          <div className="min-w-0 space-y-4">
            {preview.summary && <p className="whitespace-pre-line text-sm text-muted-foreground">{preview.summary}</p>}
            {preview.ownSession && parts.isPending && <p className="text-sm text-muted-foreground">Hämtar passets innehåll…</p>}
            {preview.ownSession && parts.isError && <div role="alert" className="text-sm text-destructive">Passets innehåll kunde inte hämtas. <Button variant="outline" size="sm" onClick={() => void parts.refetch()}>Försök igen</Button></div>}
            {minutes != null && <p className="text-sm font-semibold">{minutes} minuter{blocks ? ` · ${blocks.length} passdelar` : ""}</p>}
            {blocks && <ol className="divide-y divide-border">{blocks.map((block, index) => <li key={index} className="py-4"><h3 className="font-display font-semibold">{index + 1}. {block.title} · {block.minutes} min</h3>{block.note && <p className="mt-1 whitespace-pre-line text-sm">{block.note}</p>}<ExerciseGuide guide={block.details ?? null} /></li>)}</ol>}
            {blocks?.length === 0 && previewReady && <p className="text-sm text-muted-foreground">Passet har inga sparade övningar ännu.</p>}
            <ExerciseGuide guide={preview.details} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Träningsinnehåll">{Object.keys(groups).map((name) => <Button key={name} role="tab" aria-selected={category === name} variant={category === name ? "default" : "outline"} size="sm" onClick={() => { setCategory(name); setQuery(""); }}>{name}</Button>)}</div>
            <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden /><Input className="pl-9" aria-label="Sök träningsinnehåll" placeholder="Sök på namn" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
             {loading ? <p className="text-sm text-muted-foreground">Hämtar innehåll…</p> : failed ? <div role="alert" className="text-sm text-destructive">Innehållet kunde inte hämtas. <Button variant="outline" size="sm" onClick={() => { void activeQuery.refetch(); if (category === "Övningar") void own.refetch(); }}>Försök igen</Button></div> : <ul className="divide-y divide-border">{(groups[category] ?? []).filter((item) => item.title.toLocaleLowerCase("sv-SE").includes(query.toLocaleLowerCase("sv-SE"))).map((item) => <li key={item.resourceId}><Button variant="ghost" className="h-auto min-h-12 w-full justify-between whitespace-normal py-3 text-left" onClick={() => setPreview(item)}><span>{item.title}</span><ChevronRight className="size-4 shrink-0" aria-hidden /></Button></li>)}{(groups[category] ?? []).filter((item) => item.title.toLocaleLowerCase("sv-SE").includes(query.toLocaleLowerCase("sv-SE"))).length === 0 && <li className="py-4 text-sm text-muted-foreground">{query ? "Inget innehåll matchar din sökning." : "Inget sparat här ännu."}</li>}</ul>}
          </div>
        )}
        {preview && <DialogFooter><Button variant="outline" disabled={pending} onClick={() => setPreview(null)}><ArrowLeft className="size-4" /> Tillbaka</Button><Button disabled={pending || !previewReady || (Boolean(blocks) && blocks?.length === 0)} onClick={() => onSelect({ kind: preview.kind, resourceId: preview.resourceId, title: preview.title, minutes: minutes ?? null, details: preview.details })}><Check className="size-4" /> {pending ? "Kopplar…" : "Välj"}</Button></DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}