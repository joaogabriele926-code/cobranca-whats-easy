import { createFileRoute } from "@tanstack/react-router";

type Upsert = {
  event?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean };
    message?: Record<string, unknown>;
    pushName?: string;
  };
};

function extractText(message: Record<string, unknown> | undefined): string {
  if (!message) return "";
  const m = message as Record<string, any>;
  return (
    m["conversation"] ??
    m["extendedTextMessage"]?.text ??
    m["imageMessage"]?.caption ??
    m["documentMessage"]?.caption ??
    ""
  );
}

function hasMedia(message: Record<string, unknown> | undefined): boolean {
  if (!message) return false;
  const m = message as Record<string, any>;
  return Boolean(m["imageMessage"] || m["documentMessage"] || m["documentWithCaptionMessage"]);
}

export const Route = createFileRoute("/api/public/webhook/evolution")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { getSettings, sendText, normalizeNumber, formatBRL, logMessage } = await import(
          "@/lib/evolution.server"
        );

        let settings;
        try {
          settings = await getSettings();
        } catch {
          return new Response("sem configuração", { status: 200 });
        }

        // Token opcional de proteção do webhook
        if (settings.webhook_token) {
          const url = new URL(request.url);
          const provided =
            request.headers.get("x-webhook-token") ?? url.searchParams.get("token") ?? "";
          if (provided !== settings.webhook_token) {
            return new Response("Unauthorized", { status: 401 });
          }
        }

        const payload = (await request.json().catch(() => ({}))) as Upsert;
        const event = (payload.event ?? "").toUpperCase().replace(/\./g, "_");
        if (event && event !== "MESSAGES_UPSERT") {
          return new Response("ignorado", { status: 200 });
        }

        const key = payload.data?.key;
        if (!key || key.fromMe) return new Response("ignorado", { status: 200 });

        const from = normalizeNumber((key.remoteJid ?? "").split("@")[0] ?? "");
        const text = String(extractText(payload.data?.message) ?? "").trim();
        const media = hasMedia(payload.data?.message);

        await logMessage({
          direction: "recebida",
          number: from,
          content: text || (media ? "[anexo]" : ""),
          event: "MESSAGES_UPSERT",
        });

        const isAdmin = Boolean(settings.admin_number) && from === normalizeNumber(settings.admin_number);
        const upper = text.toUpperCase();

        // ---------- Resposta do dono/admin ----------
        if (isAdmin) {
          const decision = /^(SIM|N[ÃA]O|NAO)\s+([A-Z0-9-]+)/i.exec(upper);
          if (decision) {
            const yes = decision[1]!.toUpperCase() === "SIM";
            const code = decision[2]!.toUpperCase();
            const { data: charge } = await supabaseAdmin
              .from("charges")
              .select("*, debtors(name, whatsapp)")
              .eq("code", code)
              .maybeSingle();
            if (!charge) {
              await sendText(settings, from, `Cobrança ${code} não encontrada.`);
              return new Response("ok", { status: 200 });
            }
            const debtor = charge.debtors as unknown as { name: string; whatsapp: string };
            if (yes) {
              await supabaseAdmin
                .from("charges")
                .update({ status: "pago", paid_at: new Date().toISOString() })
                .eq("id", charge.id);
              await supabaseAdmin
                .from("payments")
                .insert({ charge_id: charge.id, amount: charge.amount });
              await sendText(settings, debtor.whatsapp, "Pagamento confirmado. Obrigado!", charge.id);
              await sendText(settings, from, `Cobrança ${code} marcada como paga.`);
            } else {
              await supabaseAdmin.from("charges").update({ status: "pendente" }).eq("id", charge.id);
              await sendText(
                settings,
                debtor.whatsapp,
                "Ainda não consegui confirmar o pagamento. Por favor confira o Pix.",
                charge.id,
              );
              await sendText(settings, from, `Cobrança ${code} mantida como pendente.`);
            }
            return new Response("ok", { status: 200 });
          }
          return new Response("ok", { status: 200 });
        }

        // ---------- Cliente informando pagamento ----------
        const paguei = /PAGUEI\s*([A-Z0-9-]+)?/i.exec(upper);
        if (paguei || media) {
          const code = paguei?.[1]?.toUpperCase();
          const query = supabaseAdmin
            .from("charges")
            .select("*, debtors!inner(name, whatsapp)")
            .neq("status", "pago")
            .order("due_date", { ascending: true })
            .limit(1);

          const { data: rows } = code
            ? await supabaseAdmin
                .from("charges")
                .select("*, debtors(name, whatsapp)")
                .eq("code", code)
                .limit(1)
            : await query;

          const charge = rows?.[0];
          if (!charge) {
            await sendText(
              settings,
              from,
              "Recebi sua mensagem, mas não localizei a cobrança. Informe: PAGUEI CODIGO",
            );
            return new Response("ok", { status: 200 });
          }

          const debtor = charge.debtors as unknown as { name: string; whatsapp: string };
          await supabaseAdmin
            .from("charges")
            .update({ status: "aguardando" })
            .eq("id", charge.id);

          await sendText(
            settings,
            settings.admin_number,
            `${debtor.name} informou pagamento da cobrança ${charge.code} no valor de R$ ${formatBRL(charge.amount)}. Confira no banco e responda: SIM ${charge.code} ou NÃO ${charge.code}`,
            charge.id,
          );
          await sendText(
            settings,
            from,
            "Recebido! Estou enviando para conferência. Assim que confirmarem, te aviso.",
            charge.id,
          );
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
