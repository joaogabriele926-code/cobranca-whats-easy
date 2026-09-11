import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | Cobrança WhatsApp" },
      {
        name: "description",
        content: "Acesse o painel do Cobrança WhatsApp para gerenciar cobranças e lembretes por WhatsApp.",
      },
      { property: "og:title", content: "Entrar | Cobrança WhatsApp" },
      {
        property: "og:description",
        content: "Acesse o painel do Cobrança WhatsApp para gerenciar cobranças e lembretes por WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.error("Informe um e-mail válido e uma senha com pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        navigate({ to: "/" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/" });
        else toast.success("Conta criada. Confirme o e-mail para entrar.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm card-surface p-6">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <MessageCircle className="size-6" />
          </span>
          <h1 className="text-xl font-bold">Cobrança WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signup" ? "Crie sua conta de administrador" : "Entre no painel do administrador"}
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-md px-3 py-2 font-medium transition ${
              mode === "signup" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Criar conta
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-md px-3 py-2 font-medium transition ${
              mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Entrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={72}
              required
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {mode === "login" ? "Preciso criar uma conta" : "Já tenho conta, quero entrar"}
        </button>
      </div>
    </main>
  );
}