import { describe, expect, it } from "vitest";
import { KNOWLEDGE_TOPICS, knowledgeTopicId, knowledgeTopicLabel } from "./knowledge-taxonomy";
import { fetchArticles, saveArticle } from "./kunskapsbank";
import { vi } from "vitest";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));

describe("kategorier som kan redigeras utan informationsförlust", () => {
  it.each(Object.entries(KNOWLEDGE_TOPICS))(
    "bevarar %s vid mappning fram och tillbaka",
    (id, label) => {
      expect(knowledgeTopicId(label)).toBe(id);
      expect(knowledgeTopicLabel(knowledgeTopicId(label))).toBe(label);
    },
  );

  it("lägger inte en okänd kategori under ledarskap", () => {
    expect(knowledgeTopicLabel(knowledgeTopicId("Nytt ämne"))).toBe("Nytt ämne");
  });

  it.each(["Börja som tränare", "Träningsplanering", "Trygghet och inkludering"])(
    "behåller %s när en administratör bara ändrar titeln",
    async (category) => {
      const row = {
        id: "KB001",
        title_sv: "Test",
        summary_sv: "Sammanfattning",
        coach_value: null,
        category,
        level: "Grund",
        source_name: "SvFF",
        original_url: "https://svenskfotboll.se",
        checked_date: "2026-10-15",
        is_published: true,
        age_5_7: true,
        age_8_9: true,
        age_10: true,
      };
      const eq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn().mockReturnValue({ eq });
      from.mockReturnValue({
        select: () => ({ order: async () => ({ data: [row], error: null }) }),
        update,
      });
      const [article] = await fetchArticles();
      if (!article) throw new Error("Testartikeln saknas");
      await saveArticle({ ...article, title: "Ny titel" }, "admin");
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ category, title_sv: "Ny titel" }),
      );
      expect(eq).toHaveBeenCalledWith("id", "KB001");
    },
  );
});
