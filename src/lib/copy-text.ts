/**
 * Kopiering som fungerar även i mobilappen, i inbäddad förhandsvisning och
 * när webbläsaren nekar klippbordet. Returnerar false om inget kunde kopieras.
 * Reservfältet städas alltid bort, även när kopieringen kastar.
 */
export async function copyText(value: string): Promise<boolean> {
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* faller tillbaka nedan */
  }
  if (typeof document === "undefined" || !document.body) return false;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const field = document.createElement("textarea");
  try {
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    try {
      if (field.isConnected) document.body.removeChild(field);
    } catch {
      /* städningsfel ska aldrig synkas användaren */
    }
    try {
      previousFocus?.focus();
    } catch {
      /* fokus kunde inte återställas */
    }
  }
}
