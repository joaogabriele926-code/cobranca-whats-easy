import { createFileRoute } from "@tanstack/react-router";

/**
 * Rotina automática de cobrança.
 * Chamada pelo agendador às 08:00 e 10:00 (horário de Fortaleza, UTC-3).
 * Envia apenas cobranças pendentes com vencimento hoje ou vencido.
 */
export const Route = createFileRoute("/api/public/hooks/enviar-cobrancas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["CHARGE_CRON_TOKEN"];
        const auth = request.headers.get("authorization") ?? "";
        const token = /^Bearer\s+(.+)$/.exec(auth)?.[1] ?? "";
        if (!expected || token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { getSettings, sendText, buildChargeMessage } = await import(
          "@/lib/evolution.server"
        );

        // Janela permitida: 08:00 às 10:00 no fuso de Fortaleza (UTC-3)
        const nowLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const hour = nowLocal.getUTCHours();
        if (hour < 8 || hour > 10) {
          return Response.json({ skipped: true, reason: "fora da janela 08h-10h" });
        }

        const today = nowLocal.toISOString().slice(0, 10);

        let settings;
        try {
          settings = await getSettings();
        } catch {
          return Response.json({ sent: 0, reason: "sem configuração" });
        }
        if (!settings.api_key) return Response.json({ sent: 0, reason: "sem chave" });

        const { data: charges } = await supabaseAdmin
          .from("charges")
          .select("*, debtors(name, whatsapp)")
          .eq("status", "pendente")
          .lte("due_date", today);

        let sent = 0;
        for (const charge of charges ?? []) {
          // Não repetir envio no mesmo dia
          if (charge.last_sent_at && charge.last_sent_at.slice(0, 10) === new Date().toISOString().slice(0, 10)) {
            const lastHour = new Date(charge.last_sent_at).getUTCHours() - 3;
            if (lastHour >= hour - 1) continue;
          }
          const debtor = charge.debtors as unknown as { name: string; whatsapp: string } | null;
          if (!debtor) continue;
          const text = buildChargeMessage({
            name: debtor.name,
            description: charge.description,
            amount: charge.amount,
            installment: charge.installment,
            total: charge.total_installments,
            dueDate: charge.due_date,
            code: charge.code,
            settings,
          });
          try {
            const r = await sendText(settings, debtor.whatsapp, text, charge.id);
            if (r.ok) {
              sent += 1;
              await supabaseAdmin
                .from("charges")
                .update({ last_sent_at: new Date().toISOString() })
                .eq("id", charge.id);
            }
          } catch {
            // segue para a próxima cobrança
          }
        }

        return Response.json({ sent, total: charges?.length ?? 0 });
      },
    },
  },
});
