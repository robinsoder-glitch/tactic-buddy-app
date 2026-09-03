import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  PLAYER_LINK_LABELS,
  inviteRecipientLabel,
  openInvitesForPlayer,
  playerLinkDetail,
  playerLinkState,
  type PlayerLink,
} from "./player-onboarding";
import type { TeamInvite } from "./teams";

function invite(patch: Partial<TeamInvite>): TeamInvite {
  return {
    id: "i1",
    team_id: "t1",
    email: null,
    role: "player",
    created_at: "2026-01-01T00:00:00Z",
    token: "abc",
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    accepted_at: null,
    revoked_at: null,
    invite_kind: "link",
    recipient_label: null,
    target_player_id: "p1",
    ...patch,
  };
}

describe("inbjudan till spelarkort", () => {
  it("namnger mottagaren tydligt", () => {
    expect(inviteRecipientLabel("Elias", "player")).toBe("Elias");
    expect(inviteRecipientLabel(" Elias ", "guardian")).toBe("Vårdnadshavare till Elias");
  });

  it("räknar bara öppna inbjudningar", () => {
    const rows = [
      invite({ id: "open" }),
      invite({ id: "used", accepted_at: "2026-01-02T00:00:00Z" }),
      invite({ id: "revoked", revoked_at: "2026-01-02T00:00:00Z" }),
      invite({ id: "expired", expires_at: "2020-01-01T00:00:00Z" }),
      invite({ id: "other", target_player_id: "p2" }),
    ];
    expect(openInvitesForPlayer("p1", rows).map((row) => row.id)).toEqual(["open"]);
  });

  it("visar rätt status för spelarkortet", () => {
    const linked: Record<string, PlayerLink> = {
      p1: { player_id: "p1", member_user_id: "u1", guardians: 0 },
    };
    expect(playerLinkState("p1", linked, [])).toBe("linked");
    expect(playerLinkState("p1", {}, [invite({})])).toBe("invited");
    expect(playerLinkState("p1", {}, [])).toBe("none");
    expect(PLAYER_LINK_LABELS.none).toBe("Inget konto ännu");
  });

  it("beskriver kopplingen i klartext", () => {
    expect(playerLinkDetail(undefined)).toBe("Ingen koppling ännu.");
    expect(playerLinkDetail({ player_id: "p1", member_user_id: null, guardians: 2 })).toBe(
      "2 vårdnadshavare kopplade",
    );
    expect(playerLinkDetail({ player_id: "p1", member_user_id: "u1", guardians: 1 })).toBe(
      "spelaren har eget konto · 1 vårdnadshavare kopplad",
    );
  });
});
