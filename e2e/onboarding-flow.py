"""E2E: inloggning, val av kontotyp, retur till rätt sida och utloggning.

Kör:  python3 e2e/onboarding-flow.py
Skapar ett eget testkonto med slumpad e-postadress mot den lokala appen.
"""

import asyncio
import json
import os
import random
import string
import sys

from playwright.async_api import async_playwright

BASE = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
PASSWORD = "Testkonto123!"


def env_from_file(name: str) -> str:
    for line in open(os.path.join(os.path.dirname(__file__), "..", ".env")):
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit(f"Saknar {name} i .env")


SUPABASE_URL = env_from_file("VITE_SUPABASE_URL")
SUPABASE_KEY = env_from_file("VITE_SUPABASE_PUBLISHABLE_KEY")

steps: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    steps.append((name, ok, detail))
    print(("PASS  " if ok else "FAIL  ") + name + ((" – " + detail) if detail else ""))


def random_email() -> str:
    tag = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"e2e.{tag}@fotbollsrummet.test"


async def click_button(page, name: str, expect: str | None = None) -> None:
    """Klickar och gör om försöket tills sidan reagerat (appen hydreras strax efter laddning)."""
    button = page.get_by_role("button", name=name).first
    await button.wait_for(state="visible", timeout=20000)
    for attempt in range(6):
        await button.click()
        if not expect:
            await page.wait_for_timeout(500)
            return
        try:
            await page.wait_for_selector(expect, timeout=2500)
            return
        except Exception:
            if attempt == 5:
                raise
            await page.wait_for_timeout(500)


async def fill_setup(page, name: str) -> None:
    await page.wait_for_selector("#setup-name", timeout=20000)
    await page.fill("#setup-name", name)
    birth = page.locator("#setup-birth")
    if await birth.count():
        await birth.fill("1990-01-01")
    box = page.get_by_role("checkbox")
    if await box.count():
        try:
            await box.first.check()
        except Exception:
            pass


async def clear_account_kind(page) -> bool:
    """Gör kontot halvfärdigt igen: kontotypen tas bort från profilen."""
    result = await page.evaluate(
        """async ([url, key]) => {
          const raw = Object.keys(localStorage).filter((k) => k.includes('auth-token'))
            .map((k) => localStorage.getItem(k)).find(Boolean);
          if (!raw) return { ok: false, why: 'ingen session' };
          const session = JSON.parse(raw);
          const token = session.access_token || session?.currentSession?.access_token;
          const uid = session.user?.id || session?.currentSession?.user?.id;
          const res = await fetch(`${url}/rest/v1/profiles?id=eq.${uid}`, {
            method: 'PATCH',
            headers: {
              apikey: key,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ account_kind: null }),
          });
          return { ok: res.ok, why: res.ok ? '' : await res.text() };
        }""",
        [SUPABASE_URL, SUPABASE_KEY],
    )
    return bool(result.get("ok")), result.get("why", "")


async def main() -> int:
    email = random_email()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 390, "height": 1800})
        page = await context.new_page()

        # 1. Skapa konto (tränare utan kod)
        await page.goto(f"{BASE}/auth?mode=signup", wait_until="domcontentloaded")
        await click_button(page, "Jag är tränare eller ledare", "#setup-name")
        await fill_setup(page, "E2E Tränare")
        await page.fill("input[type=email]", email)
        await page.fill("input[type=password]", PASSWORD)
        await click_button(page, "Skapa konto")
        try:
            await page.wait_for_url(lambda url: "/auth" not in url, timeout=20000)
            check("Nytt konto loggas in och lämnar inloggningssidan", True, page.url)
        except Exception:
            check("Nytt konto loggas in och lämnar inloggningssidan", False, page.url)
            await browser.close()
            return 1

        # 2. Gör kontot halvfärdigt (kontotyp saknas)
        ok, why = await clear_account_kind(page)
        check("Kontot kan sättas i halvfärdigt läge för testet", ok, why)
        if not ok:
            await browser.close()
            return 1

        # 3. Skyddad sida direkt via länk -> styrs till val av kontotyp
        await page.goto(f"{BASE}/kalender", wait_until="domcontentloaded")
        await page.wait_for_url("**/onboarding**", timeout=20000)
        check(
            "Skyddad länk styr halvfärdigt konto till val av kontotyp",
            "/onboarding" in page.url and "kalender" in page.url,
            page.url,
        )

        # 4. Välj kontotyp och spara -> tillbaka till sidan man ville åt
        await click_button(page, "Jag är tränare eller ledare", "#setup-name")
        await fill_setup(page, "E2E Tränare")
        await click_button(page, "Skapa tränarkonto")
        try:
            await page.wait_for_url("**/kalender**", timeout=20000)
            check("Efter sparning kommer man tillbaka till kalendern", True, page.url)
        except Exception:
            check("Efter sparning kommer man tillbaka till kalendern", False, page.url)

        # 5. Färdigt konto som öppnar sidan manuellt har väg tillbaka
        await page.goto(f"{BASE}/onboarding", wait_until="domcontentloaded")
        back = page.get_by_role("button", name="Tillbaka till appen")
        try:
            await back.wait_for(timeout=15000)
            await back.click()
            await page.wait_for_url(lambda url: "/onboarding" not in url, timeout=15000)
            check("Färdigt konto har väg tillbaka från val av kontotyp", True, page.url)
        except Exception:
            check("Färdigt konto har väg tillbaka från val av kontotyp", False, page.url)

        # 6. Logga ut från val av kontotyp
        ok, why = await clear_account_kind(page)
        check("Kontot kan sättas i halvfärdigt läge igen", ok, why)
        await page.goto(f"{BASE}/onboarding", wait_until="domcontentloaded")
        await click_button(page, "Logga ut")
        try:
            await page.wait_for_url("**/auth**", timeout=20000)
            await page.get_by_role("button", name="Logga in", exact=False).first.wait_for(
                timeout=10000
            )
            check("Logga ut leder till inloggningssidan", True, page.url)
        except Exception:
            check("Logga ut leder till inloggningssidan", False, page.url)

        await page.screenshot(path="/tmp/browser/onboarding-e2e.png")
        await browser.close()

    failed = [s for s in steps if not s[1]]
    print(json.dumps({"total": len(steps), "failed": len(failed)}, ensure_ascii=False))
    return 1 if failed else 0


if __name__ == "__main__":
    os.makedirs("/tmp/browser", exist_ok=True)
    sys.exit(asyncio.run(main()))
