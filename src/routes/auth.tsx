import { finluxMeta } from '@/lib/route-meta';
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { LuxAvatar } from "@/components/lux/lux-avatar";

export const Route = createFileRoute("/auth")({
  head: () => finluxMeta('Entrar — Finlux', 'Entre na sua conta Finlux para acompanhar suas finanças.'),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao autenticar");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setErr(null);
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setErr(result.error.message);
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <LuxAvatar emotion="recepcionando" size={112} className="mx-auto" />
          <h1 className="mt-2 text-3xl font-bold">Finlux</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sou o Lux, seu parceiro financeiro. Vamos começar?
          </p>
        </div>

        <div className="rounded-3xl bg-card border border-border p-6">
          <div className="grid grid-cols-2 gap-1 bg-card-elevated p-1 rounded-2xl mb-5">
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`py-2.5 rounded-xl text-sm font-bold transition-colors ${
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {m === "signin" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 ring-primary"
              />
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              className="w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 ring-primary"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="w-full bg-card-elevated rounded-xl px-4 py-3 text-foreground outline-none focus:ring-2 ring-primary"
            />
            {err && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">
                {err}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-primary text-primary-foreground py-3.5 font-bold disabled:opacity-60 active:scale-[0.98] transition-transform"
            >
              {busy ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={google}
            disabled={busy}
            className="w-full rounded-2xl bg-card-elevated border border-border py-3 font-semibold text-foreground flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <GoogleIcon /> Continuar com Google
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 7 29.3 5 24 5 16.3 5 9.7 9.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.2C40.9 35.7 44 30.3 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
