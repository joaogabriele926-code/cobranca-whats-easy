import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { type ChangeEvent, type FormEvent, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { markPaid, sendCharge } from "@/lib/cobranca.functions";
import { brl, dateBR, newChargeCode, normalizeWhats, statusClass, statusLabel, type Charge } from "@/lib/cobranca";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, Send, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cobrancas")({
  head: () => ({
    meta: [
      { title: "Cobranças | Cobrança WhatsApp" },
      {
        name: "description",
        content: "Cadastre devedores, envie cobranças pelo WhatsApp e acompanhe confirmações.",
      },
    ],
  }),
  component: ChargesPage,
});

const initialForm = {
  name: "",
  whatsapp: "",
  description: "",
  amount: "",
  installment: "1",
  total_installments: "1",
  due_date: new Date().toISOString().slice(0, 10),
  monthly: false,
};

function parseMoney(value: string) {
  const clean = value.trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const number = Number(normalized);
  if (!Number.isFinite(number) || number <= 0) throw new Error("Informe um valor maior que zero.");
  return Math.round(number * 100) / 100;
}

function ChargesPage() {
  const enviar = useServerFn(sendCharge);
  const pagar = useServerFn(markPaid);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: charges = [], refetch } = useQuery({
    queryKey: ["charges-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("charges")
        .select("*, debtors(id, name, whatsapp)")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as unknown as Charge[];
    },
  });

  const set = (key: keyof typeof initialForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.currentTarget.type === "checkbox"
      ? (event.currentTarget as HTMLInputElement).checked
      : event.currentTarget.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  async function createCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    try {
      const whatsapp = normalizeWhats(form.whatsapp);
      if (!/^55\d{10,11}$/.test(whatsapp)) throw new Error("Informe WhatsApp com DDD.");
      if (form.name.trim().length < 2) throw new Error("Informe o nome do devedor.");
      if (form.description.trim().length < 2) throw new Error("Informe a descrição da cobrança.");

      let debtorId: string | undefined;
      const { data: existingDebtor, error: findError } = await supabase
        .from("debtors")
        .select("id")
        .eq("whatsapp", whatsapp)
        .maybeSingle();
      if (findError) throw findError;
      debtorId = existingDebtor?.id;

      if (!debtorId) {
        const { data: debtor, error } = await supabase
          .from("debtors")
          .insert({ name: form.name.trim(), whatsapp })
          .select("id")
          .single();
        if (error) throw error;
        debtorId = debtor.id;
      }

      const amount = parseMoney(form.amount);
      const installment = Math.max(1, Number.parseInt(form.installment, 10) || 1);
      const total = Math.max(installment, Number.parseInt(form.total_installments, 10) || installment);

      const { error: chargeError } = await supabase.from("charges").insert({
        debtor_id: debtorId,
        code: newChargeCode(),
        description: form.description.trim(),
        amount,
        installment,
        total_installments: total,
        due_date: form.due_date,
        monthly: form.monthly,
        status: "pendente",
      });
      if (chargeError) throw chargeError;

      toast.success("Cobrança cadastrada.");
      setForm(initialForm);
      await refetch();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function runAction(name: string, action: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(name);
    try {
      const result = await action();
      result.ok ? toast.success(result.message) : toast.error(result.message);
      await refetch();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function deleteCharge(chargeId: string) {
    if (!window.confirm("Excluir esta cobrança?")) return;
    setBusy(chargeId);
    try {
      const { error } = await supabase.from("charges").delete().eq("id", chargeId);
      if (error) throw error;
      toast.success("Cobrança excluída.");
      await refetch();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Cobranças</h1>
        <p className="text-sm text-muted-foreground">Cadastre e envie pelo WhatsApp</p>
      </div>

      <form className="card-surface space-y-4 p-4" onSubmit={createCharge}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome do devedor</Label>
            <Input id="name" value={form.name} onChange={set("name")} placeholder="André" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input id="whatsapp" value={form.whatsapp} onChange={set("whatsapp")} placeholder="5585999999999" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Descrição da cobrança</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={set("description")}
            placeholder="Parcela do cartão, compra ou anuidade"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Valor</Label>
            <Input id="amount" value={form.amount} onChange={set("amount")} placeholder="150,00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="installment">Parcela</Label>
            <Input id="installment" type="number" min="1" value={form.installment} onChange={set("installment")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="total_installments">Total</Label>
            <Input
              id="total_installments"
              type="number"
              min="1"
              value={form.total_installments}
              onChange={set("total_installments")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="due_date">Vencimento</Label>
            <Input id="due_date" type="date" value={form.due_date} onChange={set("due_date")} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.monthly} onChange={set("monthly")} />
          Repetir mensalmente
        </label>

        <Button type="submit" size="lg" className="w-full" disabled={busy !== null}>
          Cadastrar cobrança
        </Button>
      </form>

      <section className="space-y-3">
        {charges.length === 0 ? (
          <div className="card-surface p-4 text-sm text-muted-foreground">Nenhuma cobrança cadastrada.</div>
        ) : (
          charges.map((charge) => (
            <article key={charge.id} className="card-surface space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{charge.debtors?.name ?? "Sem devedor"}</h2>
                  <p className="text-xs text-muted-foreground">{charge.debtors?.whatsapp}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[charge.status]}`}>
                  {statusLabel[charge.status] ?? charge.status}
                </span>
              </div>

              <div>
                <p className="text-sm">{charge.description}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {brl(charge.amount)} · parcela {charge.installment}/{charge.total_installments} · vence{" "}
                  {dateBR(charge.due_date)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Código: {charge.code}</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="secondary"
                  disabled={busy !== null || charge.status === "pago"}
                  onClick={() => runAction(charge.id, () => enviar({ data: { chargeId: charge.id } }))}
                >
                  <Send className="size-4" />
                  Enviar
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy !== null || charge.status === "pago"}
                  onClick={() => runAction(charge.id, () => pagar({ data: { chargeId: charge.id } }))}
                >
                  <Check className="size-4" />
                  Pago
                </Button>
                <Button variant="destructive" disabled={busy !== null} onClick={() => deleteCharge(charge.id)}>
                  <Trash2 className="size-4" />
                  Excluir
                </Button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}