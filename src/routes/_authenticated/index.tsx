import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendTestMessage } from "@/lib/cobranca.functions";
import { brl, statusClass, statusLabel, dateBR, type Charge } from "@/lib/cobranca";
import { Button } from "@/components/ui/button";
import { Plus, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Painel de cobranças | Cobrança WhatsApp" },
      {
        name: "description",
        content:
          "Acompanhe totais pendentes, aguardando confirmação e pagos, e envie lembretes de cobrança pelo WhatsApp.",
      },
      { property: "og:title", content: "Painel de cobranças | Cobrança WhatsApp" },
      {
        property: "og:description",
        content: "Acompanhe totais pendentes, aguardando confirmação e pagos das suas cobranças.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const testar = useServerFn(sendTestMessage);
  const [testando, setTestando] = useState(false);

  const { data: charges = [] } = useQuery({
    queryKey: ["charges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("charges")
        .select("*, debtors(id, name, whatsapp)")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as unknown as Charge[];
    },
  });

  const totals = charges.reduce(
    (acc, c) => {
      const value = Number(c.amount) || 0;
      if (c.status === "pago") {
        acc.pago += value;
        acc.pagoQtd += 1;
      } else if (c.status === "aguardando") {
        acc.aguardando += value;
        acc.aguardandoQtd += 1;
      } else {
        acc.pendente += value;
        acc.pendenteQtd += 1;
      }
      return acc;
    },
    { pendente: 0, aguardando: 0, pago: 0, pendenteQtd: 0, aguardandoQtd: 0, pagoQtd: 0 },
  );

  const cards = [
    { label: "Pendente", value: totals.pendente, qtd: totals.pendenteQtd, cls: statusClass["pendente"]! },
    { label: "Aguardando", value: totals.aguardando, qtd: totals.aguardandoQtd, cls: statusClass["aguardando"]! },
    { label: "Pago", value: totals.pago, qtd: totals.pagoQtd, cls: statusClass["pago"]! },
  ];

  const proximas = charges.filter((c) => c.status !== "pago").slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Painel</h1>
        <p className="text-sm text-muted-foreground">Resumo das suas cobranças</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-2xl p-3 ${c.cls}`}>
            <p className="text-xs font-semibold opacity-80">{c.label}</p>
            <p className="mt-1 text-base font-bold leading-tight">{brl(c.value)}</p>
            <p className="text-xs opacity-75">{c.qtd} cobrança(s)</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" className="h-16 text-base" onClick={() => navigate({ to: "/cobrancas" })}>
          <Plus className="size-5" />
          Cadastrar cobrança
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="h-16 text-base"
          disabled={testando}
          onClick={async () => {
            setTestando(true);
            try {
              const r = await testar({});
              r.ok ? toast.success(r.message) : toast.error(r.message);
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setTestando(false);
            }
          }}
        >
          <Send className="size-5" />
          Enviar teste WhatsApp
        </Button>
      </div>

      <section className="card-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Próximas cobranças</h2>
          <Link to="/cobrancas" className="text-sm text-primary underline-offset-4 hover:underline">
            ver todas
          </Link>
        </div>
        {proximas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma cobrança em aberto.</p>
        ) : (
          <ul className="divide-y divide-border">
            {proximas.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.debtors?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {brl(c.amount)} · vence {dateBR(c.due_date)}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[c.status]}`}>
                  {statusLabel[c.status] ?? c.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
