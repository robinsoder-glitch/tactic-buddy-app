import { describe, expect, it } from "vitest";
import {
  allDoneText,
  filterTodo,
  formatWhen,
  greetingName,
  isCoachTodo,
  newsLabel,
  nextLabel,
  sortTodo,
  todoBadge,
  type NextEvent,
  type TodoItem,
} from "./my-day";

function todo(partial: Partial<TodoItem>): TodoItem {
  return {
    kind: "invite_unanswered",
    priority: 2,
    team_id: "t1",
    team_name: "P2018",
    event_id: "e1",
    player_id: null,
    player_name: null,
    title: "Svara på kallelsen",
    subtitle: null,
    due_at: "2026-09-10T15:00:00Z",
    action_url: "/mina-kallelser",
    action_label: "Svara nu",
    ...partial,
  };
}

const nextEvent: NextEvent = {
  event_id: "e1",
  team_id: "t1",
  team_name: "P2018",
  type: "training",
  title: "Träning",
  starts_at: "2026-09-08T15:30:00Z",
  meet_at: null,
  location: "Bollplanen",
  action_url: "/team/t1/event/e1",
};

describe("min dag", () => {
  it("sorterar efter prioritet och sedan tid", () => {
    const items = [
      todo({ kind: "attendance_missing", priority: 7, due_at: "2026-09-01T10:00:00Z" }),
      todo({ kind: "invite_unanswered", priority: 2, due_at: "2026-09-12T10:00:00Z" }),
      todo({ kind: "invite_unanswered", priority: 2, due_at: "2026-09-10T10:00:00Z" }),
    ];
    expect(sortTodo(items).map((i) => i.due_at)).toEqual([
      "2026-09-10T10:00:00Z",
      "2026-09-12T10:00:00Z",
      "2026-09-01T10:00:00Z",
    ]);
  });

  it("filtrerar på lag", () => {
    const items = [todo({ team_id: "t1" }), todo({ team_id: "t2" })];
    expect(filterTodo(items, "team:t2")).toHaveLength(1);
    expect(filterTodo(items, "all")).toHaveLength(2);
  });

  it("filtrerar på barn", () => {
    const items = [todo({ player_id: "p1" }), todo({ player_id: "p2" })];
    expect(filterTodo(items, "player:p1")[0]?.player_id).toBe("p1");
  });

  it("skiljer ledaruppgifter från övriga", () => {
    expect(isCoachTodo("pending_join")).toBe(true);
    expect(isCoachTodo("invite_unanswered")).toBe(false);
  });

  it("hälsar med förnamn men aldrig med e-post", () => {
    expect(greetingName("Robin Söder")).toBe("Hej Robin");
    expect(greetingName("robin@example.se")).toBe("Hej!");
    expect(greetingName(null)).toBe("Hej!");
  });

  it("ger positiv text när inget behöver göras", () => {
    expect(allDoneText([])).toContain("Inga aktiviteter");
    expect(allDoneText([nextEvent])).toContain("Nästa aktivitet är träning");
  });

  it("beskriver nästa aktivitet med rätt ord", () => {
    expect(nextLabel({ ...nextEvent, type: "match" })).toContain("match");
  });

  it("skriver tider på svenska", () => {
    const now = new Date("2026-09-08T08:00:00Z");
    expect(formatWhen("2026-09-08T15:30:00Z", now)).toMatch(/^i dag/);
    expect(formatWhen("2026-09-09T15:30:00Z", now)).toMatch(/^i morgon/);
    expect(formatWhen("2026-09-20T15:30:00Z", now)).not.toMatch(/^i dag/);
    expect(formatWhen("trasig")).toBe("");
  });

  it("har svenska etiketter för alla korttyper", () => {
    expect(todoBadge("event_cancelled")).toBe("Inställd");
    expect(todoBadge("announcement_unread")).toBe("Meddelande");
    expect(newsLabel("announcement")).toBe("Viktigt meddelande");
    expect(newsLabel("okänt")).toBe("Nyhet");
  });
});
