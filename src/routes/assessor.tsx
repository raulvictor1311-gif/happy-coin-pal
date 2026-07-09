import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRef, useState } from "react";
import { Camera, Mic, Square, Sparkles, Trash2, Check, Loader2, ImageIcon, Lock, Wand2 } from "lucide-react";
import { financeActions, useFinance, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/finance-store";
import { suggestCategoryFromHistory } from "@/lib/finance-ai";
import { formatBRL } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { WhatsappConnect, AdvisorContact } from "@/components/whatsapp-connect";
import { SandboxReconnect } from "@/components/sandbox-reconnect";
import { toast } from "sonner";

export const Route = createFileRoute("/assessor")({
  head: () => ({ meta: [{ title: "Meu Assessor — Finlux" }] }),
  component: Assessor,
});

type ExtractedTx = {
  kind: "receita" | "despesa";
  amount: number;
  category: string;
  description: string;
  date: string;
  /** true quando a categoria foi preenchida a partir do histórico do usuário. */
  learned?: boolean;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      resolve(s.split(",")[1] ?? "");
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function audioFormatFromMime(mime: string): "webm" | "m4a" | "mp3" | "wav" | "ogg" | "aac" {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("aac")) return "aac";
  return "wav";
}

function Assessor() {
  const { session, loading: authLoading } = useAuth();
  const state = useFinance();
  const [text, setText] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedTx[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageDataUrl(await fileToDataUrl(file));
    e.target.value = "";
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Não consegui acessar o microfone.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function clearAll() {
    setText("");
    setImageDataUrl(null);
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setExtracted([]);
  }

  async function analyze() {
    if (!text.trim() && !imageDataUrl && !audioBlob) {
      toast.error("Adicione texto, foto ou áudio para registrar.");
      return;
    }
    setLoading(true);
    setExtracted([]);
    try {
      const payload: any = {};
      if (text.trim()) payload.text = text.trim();
      if (imageDataUrl) payload.imageDataUrl = imageDataUrl;
      if (audioBlob) {
        payload.audio = {
          base64: await blobToBase64(audioBlob),
          format: audioFormatFromMime(audioBlob.type),
        };
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/extract-tx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Falha");
      const txs: ExtractedTx[] = (j.transactions ?? []).map((t: any) => {
        const kind: "receita" | "despesa" = t.kind === "receita" ? "receita" : "despesa";
        let category = String(t.category || "Outros");
        const description = String(t.description || "");
        let learned = false;
        // Aprendizado contínuo: quando a IA fica genérica, usa o histórico.
        if (category === "Outros" || category === "Outras receitas" || !category) {
          const guess = suggestCategoryFromHistory(state, description, kind);
          if (guess && guess.support >= 1 && guess.category !== category) {
            category = guess.category;
            learned = true;
          }
        }
        return {
          kind,
          amount: Math.max(0, Number(t.amount) || 0),
          category,
          description,
          date: String(t.date || new Date().toISOString().slice(0, 10)),
          learned,
        };
      });
      if (txs.length === 0) {
        toast.error("Não consegui entender. Tente descrever com mais detalhes.");
      } else {
        setExtracted(txs);
      }
    } catch (e: any) {
      toast.error("Erro ao analisar: " + (e?.message ?? "desconhecido"));
    } finally {
      setLoading(false);
    }
  }

  function updateTx(idx: number, patch: Partial<ExtractedTx>) {
    setExtracted((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }
  function removeTx(idx: number) {
    setExtracted((prev) => prev.filter((_, i) => i !== idx));
  }

  function confirm() {
    // Validação: não registrar transações com valor inválido (Etapa 2).
    const valid = extracted.filter((t) => Number(t.amount) > 0);
    if (valid.length === 0) {
      toast.error("Nenhuma transação válida: o valor deve ser maior que zero.");
      return;
    }
    if (valid.length < extracted.length) {
      toast.error(`${extracted.length - valid.length} item(ns) ignorado(s) por valor inválido.`);
    }
    valid.forEach((t) => {
      financeActions.addTransaction({
        kind: t.kind,
        amount: t.amount,
        category: t.category,
        description: t.description || t.category,
        date: new Date(t.date).toISOString(),
      });
    });
    toast.success(`${valid.length} transação(ões) registrada(s)!`);
    clearAll();
  }

  if (!authLoading && !session) {
    return (
      <AppShell>
        <PageHeader subtitle="Registro inteligente" title="Meu Assessor" />
        <div className="px-6">
          <div className="rounded-3xl bg-card border border-border p-6 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Entre para usar o Assessor</h2>
              <p className="text-sm text-muted-foreground">
                As transações registradas pelo Assessor ficam salvas na sua conta na nuvem — assim você acessa de qualquer aparelho e, em breve, pelo WhatsApp.
              </p>
            </div>
            <Link
              to="/auth"
              className="inline-block w-full rounded-2xl bg-primary text-primary-foreground font-bold py-3 active:scale-[0.98] transition-transform"
            >
              Entrar ou criar conta
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (

    <AppShell>
      <PageHeader subtitle="Registro inteligente" title="Meu Assessor" />
      <div className="px-6 space-y-4">
        <p className="text-sm text-muted-foreground -mt-2">
          Mande uma foto da nota, grave um áudio ou escreva o que comprou. Eu cataloguei para você.
        </p>

        <SandboxReconnect />

        <WhatsappConnect />

        <AdvisorContact />



        <div className="rounded-3xl bg-card border border-border p-4 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Ex.: "Acabei de botar 300 reais de gasolina no posto"'
            rows={3}
            className="w-full bg-card-elevated rounded-2xl px-4 py-3 text-foreground outline-none focus:ring-2 ring-primary resize-none"
          />

          <div className="grid grid-cols-3 gap-2">
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
            <input ref={galleryInputRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex flex-col items-center gap-1 rounded-2xl bg-card-elevated px-3 py-3 text-foreground hover:bg-muted transition-colors active:scale-[0.97]"
            >
              <Camera className="h-5 w-5 text-primary" />
              <span className="text-xs font-semibold">Foto</span>
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex flex-col items-center gap-1 rounded-2xl bg-card-elevated px-3 py-3 text-foreground hover:bg-muted transition-colors active:scale-[0.97]"
            >
              <ImageIcon className="h-5 w-5 text-primary" />
              <span className="text-xs font-semibold">Galeria</span>
            </button>
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-3 transition-colors active:scale-[0.97] ${
                recording ? "bg-destructive/15 text-destructive" : "bg-card-elevated text-foreground hover:bg-muted"
              }`}
            >
              {recording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5 text-primary" />}
              <span className="text-xs font-semibold">{recording ? "Parar" : "Áudio"}</span>
            </button>
          </div>

          {(imageDataUrl || audioUrl) && (
            <div className="space-y-2 pt-1">
              {imageDataUrl && (
                <div className="relative">
                  <img src={imageDataUrl} alt="Recibo" className="w-full max-h-56 object-cover rounded-2xl" />
                  <button
                    onClick={() => setImageDataUrl(null)}
                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center"
                    aria-label="Remover foto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
              {audioUrl && (
                <div className="flex items-center gap-2 rounded-2xl bg-card-elevated p-2">
                  <audio src={audioUrl} controls className="flex-1 h-10" />
                  <button
                    onClick={() => { if (audioUrl) URL.revokeObjectURL(audioUrl); setAudioUrl(null); setAudioBlob(null); }}
                    className="h-9 w-9 rounded-full bg-card flex items-center justify-center text-muted-foreground hover:text-destructive"
                    aria-label="Remover áudio"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={analyze}
            disabled={loading}
            className="w-full rounded-2xl bg-primary text-primary-foreground font-bold py-3 flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Analisando..." : "Registrar com IA"}
          </button>
        </div>

        {extracted.length > 0 && (
          <div className="rounded-3xl bg-card border border-border p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">Confirme antes de salvar</h2>
              <span className="text-xs text-muted-foreground">{extracted.length} item(ns)</span>
            </div>
            {extracted.map((t, i) => {
              const cats = t.kind === "receita" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
              return (
                <div key={i} className="rounded-2xl bg-card-elevated p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={t.kind}
                      onChange={(e) => updateTx(i, { kind: e.target.value as any, category: (e.target.value === "receita" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0] })}
                      className="bg-card rounded-lg px-2 py-1 text-xs font-semibold"
                    >
                      <option value="despesa">Despesa</option>
                      <option value="receita">Receita</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={t.amount}
                      onChange={(e) => updateTx(i, { amount: Number(e.target.value) || 0 })}
                      className="flex-1 bg-card rounded-lg px-3 py-2 text-right font-bold text-foreground outline-none"
                    />
                    <button onClick={() => removeTx(i)} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive flex items-center justify-center">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    value={t.description}
                    onChange={(e) => updateTx(i, { description: e.target.value })}
                    placeholder="Descrição"
                    className="w-full bg-card rounded-lg px-3 py-2 text-sm text-foreground outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={t.category}
                      onChange={(e) => updateTx(i, { category: e.target.value, learned: false })}
                      className="bg-card rounded-lg px-3 py-2 text-sm"
                    >
                      {cats.includes(t.category) ? null : <option value={t.category}>{t.category}</option>}
                      {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input
                      type="date"
                      value={t.date}
                      onChange={(e) => updateTx(i, { date: e.target.value })}
                      className="bg-card rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{formatBRL(t.amount)} • {t.category}</p>
                    {t.learned && (
                      <span className="flex items-center gap-1 rounded-full bg-primary/12 text-primary px-2 py-0.5 text-[10px] font-semibold">
                        <Wand2 className="h-3 w-3" /> aprendido do histórico
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <button
              onClick={confirm}
              style={{ backgroundColor: "var(--color-success)" }}
              className="w-full rounded-2xl text-white font-bold py-3 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Check className="h-4 w-4" /> Confirmar e registrar
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
