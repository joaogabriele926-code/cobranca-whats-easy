import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getSettings, saveSettings, testEvolution, sendTestMessage } from "@/lib/cobranca.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, ShieldCheck, Webhook } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracao")({
  head: () => ({
    meta: [
      { title: "Configuração do Evolution | Cobrança WhatsApp" },
      {
        name: "description",
        content: "Configure a URL do Evolution, a instância do WhatsApp, a chave de API e os dados do Pix.",
      },
      { property: "og:title", content: "Configuração do Evolution | Cobrança WhatsApp" },
      {
        property: "og:description",
        content: "Configure a conexão com o WhatsApp e os dados do Pix usados nas cobranças.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConfigPage,
});

const empty = {
  evolution_url: "",
  instance_name: "",
  api_key: "",
  admin_number: "",
  pix_key: "",
  pix_holder: "",
  bank: "",
  webhook_token: "",
};

function ConfigPage() {
  const load = useServerFn(getSettings);
  const save = useServerFn(saveSettings);
  const test = useServerFn(testEvolution);
  const sendTest = useServerFn(sendTestMessage);

  const { data, refetch } = useQuery({ queryKey: ["settings"], queryFn: () => load({}) });
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState<string | null>(null);
  const webhookUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/public/webhook/evolution` : "/api/public/webhook/evolution";
  const webhookUrlWithToken = form.webhook_token
    ? `${webhookUrl}?token=${encodeURIComponent(form.webhook_token)}`
    : webhookUrl;

  useEffect(() => {
    if (data) {
      setForm({
        evolution_url: data.evolution_url,
        instance_name: data.instance_name,
        api_key: "",
        admin_number: data.admin_number,
        pix_key: data.pix_key,
        pix_holder: data.pix_holder,
        bank: data.bank,
        webhook_token: data.webhook_token,
      });
    }
  }, [data]);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function run(name: string, fn: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(name);
    try {
      const r = await fn();
      r.ok ? toast.success(r.message) : toast.error(r.message);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function copyWebhook(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Link do webhook copiado.");
    } catch {
      toast.error("Não consegui copiar. Selecione o link e copie manualmente.");
    }
  }

  const fields: { key: keyof typeof empty; label: string; placeholder?: string; type?: string }[] = [
    { key: "evolution_url", label: "URL base do Evolution", placeholder: "https://evolution-api.up.railway.app" },
    { key: "instance_name", label: "Nome da instância do WhatsApp", placeholder: "Julio" },
    { key: "api_key", label: "API Key do Evolution", placeholder: data?.has_api_key ? "•••••• (salva)" : "cole a chave", type: "password" },
    { key: "admin_number", label: "Número do dono/admin", placeholder: "5585996449844" },
    { key: "pix_key", label: "Chave Pix" },
    { key: "pix_holder", label: "Nome do titular Pix" },
    { key: "bank", label: "Banco" },
    { key: "webhook_token", label: "Token do webhook (opcional)" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Configuração</h1>
        <p className="text-sm text-muted-foreground">Conexão com o WhatsApp e dados do Pix</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <p>A chave de API fica guardada apenas no servidor e nunca é enviada para esta tela.</p>
      </div>

      <form
        className="card-surface space-y-4 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await run("save", async () => {
            await save({ data: form });
            await refetch();
            setForm((f) => ({ ...f, api_key: "" }));
            return { ok: true, message: "Configuração salva." };
          });
        }}
      >
        {fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input
              id={f.key}
              type={f.type ?? "text"}
              value={form[f.key]}
              onChange={set(f.key)}
              placeholder={f.placeholder ?? ""}
              maxLength={300}
              autoComplete="off"
            />
          </div>
        ))}

        <Button type="submit" size="lg" className="w-full" disabled={busy !== null}>
          Salvar configuração
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          variant="secondary"
          size="lg"
          disabled={busy !== null}
          onClick={() => run("test", () => test({}))}
        >
          Testar conexão com Evolution
        </Button>
        <Button
          variant="secondary"
          size="lg"
          disabled={busy !== null}
          onClick={() => run("msg", () => sendTest({}))}
        >
          Enviar mensagem teste
        </Button>
      </div>

      <div className="card-surface space-y-3 p-4 text-sm">
        <div className="flex items-start gap-2">
          <Webhook className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="font-semibold">Webhook do site, sem n8n</p>
            <p className="text-muted-foreground">
              Cole este link no webhook da instância no Evolution e marque o evento <code>MESSAGES_UPSERT</code>.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">URL para colocar no Evolution</p>
          <code className="mt-1 block break-all text-sm">{webhookUrlWithToken}</code>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3 gap-2"
            onClick={() => copyWebhook(webhookUrlWithToken)}
          >
            <Copy className="size-4" />
            Copiar webhook
          </Button>
        </div>

        <p className="text-muted-foreground">
          A API Key fica salva aqui no sistema para enviar mensagens. No Evolution, o webhook usa só essa URL para avisar
          o site quando alguém responder no WhatsApp.
        </p>
      </div>
    </div>
  );
}