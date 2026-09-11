import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const settingsSchema = z.object({
  evolution_url: z.string().trim().max(300),
  instance_name: z.string().trim().max(120),
  api_key: z.string().trim().max(500),
  admin_number: z.string().trim().max(30),
  pix_key: z.string().trim().max(200),
  pix_holder: z.string().trim().max(200),
  bank: z.string().trim().max(120),
  webhook_token: z.string().trim().max(200),
});

/** Devolve a configuração SEM a chave de API (apenas se está preenchida). */
export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getSettings: load } = await import("./evolution.server");
    const s = await load();
    return {
      evolution_url: s.evolution_url,
      instance_name: s.instance_name,
      admin_number: s.admin_number,
      pix_key: s.pix_key,
      pix_holder: s.pix_holder,
      bank: s.bank,
      webhook_token: s.webhook_token,
      has_api_key: Boolean(s.api_key),
    };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => settingsSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const update: Record<string, string> = {
      evolution_url: data.evolution_url,
      instance_name: data.instance_name,
      admin_number: data.admin_number,
      pix_key: data.pix_key,
      pix_holder: data.pix_holder,
      bank: data.bank,
      webhook_token: data.webhook_token,
    };
    // Só grava a chave se o usuário digitou uma nova (campo vazio = manter a atual)
    if (data.api_key) update["api_key"] = data.api_key;

    const { error } = await supabaseAdmin
      .from("settings")
      .update(update)
      .eq("singleton", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testEvolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getSettings: load, testConnection } = await import("./evolution.server");
    const s = await load();
    if (!s.evolution_url || !s.instance_name || !s.api_key) {
      return { ok: false, message: "Preencha e salve URL, instância e chave antes de testar." };
    }
    try {
      const r = await testConnection(s);
      return {
        ok: r.ok,
        message: r.ok ? `Conectado (${r.body.slice(0, 200)})` : `Erro ${r.status}: ${r.body.slice(0, 200)}`,
      };
    } catch (e) {
      return { ok: false, message: `Falha ao conectar: ${(e as Error).message}` };
    }
  });

export const sendTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getSettings: load, sendText } = await import("./evolution.server");
    const s = await load();
    if (!s.admin_number) return { ok: false, message: "Cadastre o número do dono." };
    try {
      const r = await sendText(s, s.admin_number, "[Cobranças] Mensagem de teste. Tudo funcionando!");
      return {
        ok: r.ok,
        message: r.ok ? "Mensagem de teste enviada." : `Erro ${r.status}: ${r.body.slice(0, 200)}`,
      };
    } catch (e) {
      return { ok: false, message: `Falha no envio: ${(e as Error).message}` };
    }
  });

export const sendCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ chargeId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getSettings: load, sendText, buildChargeMessage } = await import("./evolution.server");
    const s = await load();

    const { data: charge, error } = await supabaseAdmin
      .from("charges")
      .select("*, debtors(name, whatsapp)")
      .eq("id", data.chargeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!charge) return { ok: false, message: "Cobrança não encontrada." };

    const debtor = charge.debtors as unknown as { name: string; whatsapp: string };
    const text = buildChargeMessage({
      name: debtor.name,
      description: charge.description,
      amount: charge.amount,
      installment: charge.installment,
      total: charge.total_installments,
      dueDate: charge.due_date,
      code: charge.code,
      settings: s,
    });

    try {
      const r = await sendText(s, debtor.whatsapp, text, charge.id);
      if (r.ok) {
        await supabaseAdmin
          .from("charges")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("id", charge.id);
      }
      return { ok: r.ok, message: r.ok ? "Cobrança enviada." : `Erro ${r.status}: ${r.body.slice(0, 200)}` };
    } catch (e) {
      return { ok: false, message: `Falha no envio: ${(e as Error).message}` };
    }
  });

export const markPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ chargeId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getSettings: load, sendText } = await import("./evolution.server");

    const { data: charge } = await supabaseAdmin
      .from("charges")
      .select("*, debtors(name, whatsapp)")
      .eq("id", data.chargeId)
      .maybeSingle();
    if (!charge) return { ok: false, message: "Cobrança não encontrada." };

    const now = new Date().toISOString();
    await supabaseAdmin.from("charges").update({ status: "pago", paid_at: now }).eq("id", charge.id);
    await supabaseAdmin.from("payments").insert({ charge_id: charge.id, amount: charge.amount });

    try {
      const s = await load();
      const debtor = charge.debtors as unknown as { name: string; whatsapp: string };
      if (s.api_key && debtor?.whatsapp) {
        await sendText(s, debtor.whatsapp, "Pagamento confirmado. Obrigado!", charge.id);
      }
    } catch {
      // pagamento continua marcado mesmo se o WhatsApp falhar
    }
    return { ok: true, message: "Cobrança marcada como paga." };
  });
