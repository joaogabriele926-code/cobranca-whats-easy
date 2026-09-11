import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Settings = {
  id: string;
  evolution_url: string;
  instance_name: string;
  api_key: string;
  admin_number: string;
  pix_key: string;
  pix_holder: string;
  bank: string;
  webhook_token: string;
};

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("*")
    .eq("singleton", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Configuração não encontrada");
  return data as Settings;
}

/** Normaliza um número brasileiro para o formato 55DDDNUMERO */
export function normalizeNumber(raw: string): string {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return digits;
}

export function formatBRL(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return (Number.isFinite(n) ? n : 0).toFixed(2).replace(".", ",");
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export async function logMessage(entry: {
  direction: "enviada" | "recebida";
  number: string;
  content: string;
  event?: string | null;
  charge_id?: string | null;
}) {
  await supabaseAdmin.from("messages_log").insert({
    direction: entry.direction,
    number: entry.number,
    content: entry.content,
    event: entry.event ?? null,
    charge_id: entry.charge_id ?? null,
  });
}

export async function sendText(
  settings: Settings,
  number: string,
  text: string,
  chargeId?: string | null,
): Promise<{ ok: boolean; status: number; body: string }> {
  if (!settings.evolution_url || !settings.instance_name || !settings.api_key) {
    throw new Error("Configuração do Evolution incompleta.");
  }
  const base = settings.evolution_url.replace(/\/+$/, "");
  const to = normalizeNumber(number);
  const res = await fetch(
    `${base}/message/sendText/${encodeURIComponent(settings.instance_name)}`,
    {
      method: "POST",
      headers: {
        apikey: settings.api_key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ number: to, text }),
    },
  );
  const body = await res.text();
  await logMessage({
    direction: "enviada",
    number: to,
    content: text,
    event: res.ok ? "sendText_ok" : `sendText_erro_${res.status}`,
    charge_id: chargeId ?? null,
  });
  return { ok: res.ok, status: res.status, body };
}

export function buildChargeMessage(args: {
  name: string;
  description: string;
  amount: number | string;
  installment: number;
  total: number;
  dueDate: string;
  code: string;
  settings: Settings;
}) {
  const s = args.settings;
  return [
    "[Cobranças]",
    "Assistente automática de cobranças",
    "",
    `Olá, ${args.name}.`,
    "",
    "Estou passando para lembrar da cobrança:",
    args.description,
    "",
    `Valor: R$ ${formatBRL(args.amount)}`,
    `Parcela: ${args.installment}/${args.total}`,
    `Vencimento: ${formatDate(args.dueDate)}`,
    "",
    "Pix:",
    `Chave: ${s.pix_key}`,
    `Titular: ${s.pix_holder}`,
    `Banco: ${s.bank}`,
    "",
    `Após pagar, responda: PAGUEI ${args.code}`,
  ].join("\n");
}

export async function testConnection(settings: Settings) {
  const base = settings.evolution_url.replace(/\/+$/, "");
  const res = await fetch(
    `${base}/instance/connectionState/${encodeURIComponent(settings.instance_name)}`,
    { headers: { apikey: settings.api_key } },
  );
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}
