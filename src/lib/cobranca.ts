export type ChargeStatus = "pendente" | "aguardando" | "pago";

export type Debtor = { id: string; name: string; whatsapp: string };

export type Charge = {
  id: string;
  debtor_id: string;
  code: string;
  description: string;
  amount: number;
  installment: number;
  total_installments: number;
  due_date: string;
  monthly: boolean;
  status: string;
  paid_at: string | null;
  last_sent_at: string | null;
  debtors?: Debtor | null;
};

export const statusLabel: Record<string, string> = {
  pendente: "Pendente",
  aguardando: "Aguardando confirmação",
  pago: "Pago",
};

export const statusClass: Record<string, string> = {
  pendente: "bg-pending text-pending-foreground",
  aguardando: "bg-waiting text-waiting-foreground",
  pago: "bg-paid text-paid-foreground",
};

export function brl(value: number | string) {
  const n = Number(value);
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function dateBR(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function newChargeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return `COB${out}`;
}

/** Aceita com ou sem +55 e devolve 55DDDNUMERO */
export function normalizeWhats(raw: string) {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return digits;
}
