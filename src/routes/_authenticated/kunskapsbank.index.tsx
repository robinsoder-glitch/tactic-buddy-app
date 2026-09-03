import { FilterPanel, FilterRow } from "@/components/FilterPanel";
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  KB_CATEGORIES,
  KB_CATEGORY_LABELS,
  KB_LEVELS,
  KB_LEVEL_LABELS,
  KB_STATUSES,
  KB_STATUS_LABELS,
  allTags,
  deleteArticle,
  fetchArticles,
  filterArticles,
  importArticles,
  parseArticleImport,
  saveArticle,
  validateArticle,
  visibleArticles,
  type ArticleInput,
  type KbArticle,
} from "@/lib/kunskapsbank";
import { addFavorite, fetchFavorites, removeFavorite } from "@/lib/taktikbank";
import { KnowledgeLibrary } from "@/components/KnowledgeLibrary";
import { KnowledgeTabs } from "@/components/KnowledgeTabs";

import { ContentLinkAdmin } from "@/components/ContentLinkAdmin";
import { useAccount } from "@/hooks/useAccount";
import { useAuth } from "@/hooks/useAuth";
import { BackIconButton } from "@/components/BackLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ConfirmDelete";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/kunskapsbank/")({
  head: () => ({
    meta: [
      { title: "Kunskapsbank – fördjupning för barnfotbollstränare" },
      {
        name: "description",
        content:
          "Artiklar om tränarskap, teknik, spelförståelse, fysik, kost, målvakt och trygg miljö för tränare i barnfotboll 5–10 år.",
      },
      { property: "og:title", content: "Kunskapsbank – varför vi tränar som vi gör" },
      {
        property: "og:description",
        content: "Granskade artiklar med praktisk nytta för tränare i barnfotboll.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KunskapsbankPage,
});

const emptyArticle: ArticleInput = {
  title: "",
  summary: "",
  coach_value: "",
  category: "coaching",
  age_min: null,
  age_max: null,
  level: "basic",
  source_name: "",
  source_url: "",
  published_at: null,
  reviewed_at: null,
  tags: [],
  status: "unverified",
  is_published: false,
};

function KunskapsbankPage() {
  const { isAdmin, loading } = useAccount();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState("all");
  const age = "all";
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const selectedTags: string[] = [];
  const [editing, setEditing] = useState<ArticleInput | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const articles = useQuery({ queryKey: ["kb-articles"], queryFn: fetchArticles, enabled: !!user });
  const favorites = useQuery({
    queryKey: ["tb-favorites"],
    queryFn: fetchFavorites,
    enabled: !!user,
  });

  const favoriteSet = useMemo(
    () => new Set((favorites.data ?? []).map((item) => `${item.kind}:${item.resource_id}`)),
    [favorites.data],
  );

  const toggleFavorite = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Inte inloggad");
      if (favoriteSet.has(`article:${id}`)) await removeFavorite(user.id, "article" as never, id);
      else await addFavorite(user.id, "article" as never, id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tb-favorites"] }),
  });

  const save = useMutation({
    mutationFn: async (input: ArticleInput) => {
      if (!user) throw new Error("Inte inloggad");
      const errors = validateArticle(input);
      setFormErrors(errors);
      if (errors.length) throw new Error(errors[0]);
      await saveArticle(input, user.id);
    },
    onSuccess: () => {
      setEditing(null);
      setFormErrors([]);
      queryClient.invalidateQueries({ queryKey: ["kb-articles"] });
      toast.success("Artikeln sparades");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Kunde inte spara artikeln"),
  });

  const importFile = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Inte inloggad");
      const result = parseArticleImport(await file.text(), articles.data ?? []);
      const created = await importArticles(result.toImport, user.id);
      return { ...result, created };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["kb-articles"] });
      const parts = [`${result.created} artiklar importerades`];
      if (result.duplicates) parts.push(`${result.duplicates} dubbletter hoppades över`);
      if (result.invalid.length) parts.push(`${result.invalid.length} hade fel och lästes inte in`);
      toast.success(parts.join(" · "));
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Kunde inte importera filen"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteArticle(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kb-articles"] }),
    onError: () => toast.error("Kunde inte radera artikeln"),
  });

  const list = filterArticles(visibleArticles(articles.data ?? [], isAdmin), {
    query,
    category,
    level,
    age,
    tags: selectedTags,
    onlyFavorites,
    favorites: favoriteSet,
  });

  if (loading) {
    return (
      <main className="grid min-h-dvh place-items-center text-muted-foreground">Laddar…</main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-6">
      <header className="flex items-center gap-2">
        <BackIconButton fallback="/" label="Tillbaka" />
        <div className="flex-1">
          <p className="font-display text-xs tracking-[0.3em] text-primary">Varför vi gör så här</p>
          <h1 className="font-display text-3xl font-bold">Kunskapsbank</h1>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" disabled={importFile.isPending}>
              <label className="cursor-pointer">
                <Upload className="size-4" /> Importera
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  aria-label="Importera artiklar från fil"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) importFile.mutate(file);
                  }}
                />
              </label>
            </Button>
            <Button
              onClick={() => {
                setFormErrors([]);
                setEditing({ ...emptyArticle });
              }}
            >
              <Plus className="size-4" /> Ny artikel
            </Button>
          </div>
        )}
      </header>

      <KnowledgeTabs active="articles" />

      <p className="mt-4 text-sm text-muted-foreground">
        Fördjupning för dig som tränar barn, särskilt 5–10 år. Här förklaras varför vi tränar som vi
        gör – med källa och granskning.
      </p>

      <KnowledgeLibrary />

      {isAdmin && (
        <>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Sök på titel, innehåll eller tagg"
              aria-label="Sök i kunskapsbanken"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <FilterPanel
            activeCount={
              (onlyFavorites ? 1 : 0) + [category, level].filter((value) => value !== "all").length
            }
            onClear={() => {
              setOnlyFavorites(false);
              setCategory("all");
              setLevel("all");
            }}
            primary={
              <button
                type="button"
                onClick={() => setOnlyFavorites((value) => !value)}
                aria-pressed={onlyFavorites}
                className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                  onlyFavorites
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                <Star className={`size-3.5 ${onlyFavorites ? "fill-current" : ""}`} /> Favoriter
              </button>
            }
          >
            <FilterRow title="Kategori">
              <FilterGroup
                value={category}
                onChange={setCategory}
                options={[
                  ["all", "Alla kategorier"],
                  ...KB_CATEGORIES.map(
                    (item) => [item, KB_CATEGORY_LABELS[item]] as [string, string],
                  ),
                ]}
              />
            </FilterRow>
            <FilterRow title="Kunskapsnivå">
              <FilterGroup
                value={level}
                onChange={setLevel}
                options={[
                  ["all", "Alla kunskapsnivåer"],
                  ...KB_LEVELS.map((item) => [item, KB_LEVEL_LABELS[item]] as [string, string]),
                ]}
              />
            </FilterRow>
          </FilterPanel>

          <section className="mt-4 space-y-3" aria-label="Artiklar">
            {articles.isLoading && (
              <p className="text-sm text-muted-foreground">Laddar artiklar…</p>
            )}
            {!articles.isLoading && list.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <GraduationCap className="mx-auto size-8 text-primary" />
                <p className="mt-3 font-display text-lg font-semibold">Inga artiklar ännu</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Kunskapsbanken är förberedd med kategorier och filter. Artiklarna läggs in i nästa
                  steg.
                </p>
              </div>
            )}
            {list.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                isAdmin={isAdmin}
                favorite={favoriteSet.has(`article:${article.id}`)}
                onFavorite={() => toggleFavorite.mutate(article.id)}
                onEdit={() => {
                  setFormErrors([]);
                  setEditing({ ...article });
                }}
                onDelete={() => {
                  void confirm({
                    title: "Radera artikel",
                    description: `${article.title} tas bort permanent.`,
                  }).then((ok) => ok && remove.mutate(article.id));
                }}
              />
            ))}
          </section>

          <section className="mt-8">
            <h2 className="font-display text-sm tracking-[0.2em] text-muted-foreground">
              Kategorier
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {KB_CATEGORIES.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                >
                  {KB_CATEGORY_LABELS[item]}
                </span>
              ))}
            </div>
          </section>
        </>
      )}

      {isAdmin && <ContentLinkAdmin />}

      {isAdmin && (
        <ArticleDialog
          value={editing}
          onChange={setEditing}
          errors={formErrors}
          onSave={() => editing && save.mutate(editing)}
          saving={save.isPending}
        />
      )}
      {confirmDialog}
    </main>
  );
}

function ArticleCard({
  article,
  isAdmin,
  favorite,
  onFavorite,
  onEdit,
  onDelete,
}: {
  article: KbArticle;
  isAdmin: boolean;
  favorite: boolean;
  onFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs tracking-wide text-muted-foreground">
            {KB_CATEGORY_LABELS[article.category] ?? article.category} ·{" "}
            {KB_LEVEL_LABELS[article.level] ?? article.level}
          </p>
          <h3 className="font-display text-lg font-semibold">{article.title}</h3>
          {article.summary && (
            <p className="mt-1 text-sm text-muted-foreground">{article.summary}</p>
          )}
          {article.coach_value && (
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">Nytta för dig som tränare: </span>
              {article.coach_value}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border px-2 py-0.5">
              {KB_STATUS_LABELS[article.status] ?? article.status}
            </span>
            {isAdmin && !article.is_published && (
              <span className="rounded-full border border-border px-2 py-0.5">Ej publicerad</span>
            )}
            {article.published_at && <span>Publicerad {article.published_at}</span>}
            {article.reviewed_at && <span>Senast granskad {article.reviewed_at}</span>}
            {article.source_name && <span>Källa: {article.source_name}</span>}
          </div>
          {article.tags?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {article.source_url && (
            <a
              href={article.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
            >
              Öppna källa <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            aria-label={favorite ? "Ta bort favorit" : "Spara som favorit"}
            aria-pressed={favorite}
            onClick={onFavorite}
            className="rounded-full p-2 text-muted-foreground hover:text-primary"
          >
            <Star className={`size-5 ${favorite ? "fill-primary text-primary" : ""}`} />
          </button>
          {isAdmin && (
            <>
              <button
                type="button"
                aria-label="Redigera artikel"
                onClick={onEdit}
                className="rounded-full p-2 text-muted-foreground hover:text-primary"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Radera artikel"
                onClick={onDelete}
                className="rounded-full p-2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function ArticleDialog({
  value,
  onChange,
  errors,
  onSave,
  saving,
}: {
  value: ArticleInput | null;
  onChange: (value: ArticleInput | null) => void;
  errors: string[];
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Dialog open={value !== null} onOpenChange={(open) => !open && onChange(null)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{value?.id ? "Redigera artikel" : "Ny artikel"}</DialogTitle>
        </DialogHeader>
        {errors.length > 0 && (
          <ul
            className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
        {value && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="kb-title">Titel</Label>
              <Input
                id="kb-title"
                value={value.title}
                onChange={(e) => onChange({ ...value, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-summary">Kort sammanfattning</Label>
              <Textarea
                id="kb-summary"
                value={value.summary ?? ""}
                onChange={(e) => onChange({ ...value, summary: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-value">Praktisk nytta för tränaren</Label>
              <Textarea
                id="kb-value"
                value={value.coach_value ?? ""}
                onChange={(e) => onChange({ ...value, coach_value: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-category">Kategori</Label>
              <select
                id="kb-category"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={value.category}
                onChange={(e) => onChange({ ...value, category: e.target.value })}
              >
                {KB_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {KB_CATEGORY_LABELS[item]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="kb-age-min">Ålder från</Label>
                <Input
                  id="kb-age-min"
                  inputMode="numeric"
                  value={value.age_min ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      age_min: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kb-age-max">Ålder till</Label>
                <Input
                  id="kb-age-max"
                  inputMode="numeric"
                  value={value.age_max ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      age_max: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-level">Kunskapsnivå</Label>
              <select
                id="kb-level"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={value.level}
                onChange={(e) => onChange({ ...value, level: e.target.value })}
              >
                {KB_LEVELS.map((item) => (
                  <option key={item} value={item}>
                    {KB_LEVEL_LABELS[item]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-source">Källa</Label>
              <Input
                id="kb-source"
                value={value.source_name ?? ""}
                onChange={(e) => onChange({ ...value, source_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-url">Länk till originalkällan</Label>
              <Input
                id="kb-url"
                value={value.source_url ?? ""}
                onChange={(e) => onChange({ ...value, source_url: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="kb-published">Publiceringsdatum</Label>
                <Input
                  id="kb-published"
                  type="date"
                  value={value.published_at ?? ""}
                  onChange={(e) => onChange({ ...value, published_at: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kb-reviewed">Senast granskad</Label>
                <Input
                  id="kb-reviewed"
                  type="date"
                  value={value.reviewed_at ?? ""}
                  onChange={(e) => onChange({ ...value, reviewed_at: e.target.value || null })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-tags">Taggar (separera med komma)</Label>
              <Input
                id="kb-tags"
                value={(value.tags ?? []).join(", ")}
                onChange={(e) =>
                  onChange({
                    ...value,
                    tags: e.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-status">Status</Label>
              <select
                id="kb-status"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={value.status}
                onChange={(e) => onChange({ ...value, status: e.target.value })}
              >
                {KB_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {KB_STATUS_LABELS[item]}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.is_published}
                onChange={(e) => onChange({ ...value, is_published: e.target.checked })}
              />
              Publicerad för alla inloggade
            </label>
            <p className="text-xs text-muted-foreground">
              Endast artiklar som är både publicerade och verifierade visas för vanliga användare.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button onClick={onSave} disabled={saving}>
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterGroup({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-full border px-3 py-1 text-xs ${
            value === key
              ? "border-primary bg-primary/15 text-foreground"
              : "border-border text-muted-foreground"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
