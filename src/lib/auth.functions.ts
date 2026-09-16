import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Kollar om det finns ett konto med en viss e-postadress.
 * Används vid inloggning så att vi kan visa tydligare felmeddelanden.
 * Ingen annan information om kontot läcker ut.
 */
export const checkEmailExists = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z
          .string()
          .email()
          .transform((v) => v.trim().toLowerCase()),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ exists: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email;
    const pageSize = 1000;
    let page = 1;

    while (page <= 50) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: pageSize,
      });

      if (error) {
        throw new Error(error.message);
      }

      const found = list.users.find((user) => (user.email ?? "").toLowerCase() === email);
      if (found) {
        return { exists: true };
      }

      if (list.users.length < pageSize) {
        break;
      }
      page += 1;
    }

    return { exists: false };
  });
