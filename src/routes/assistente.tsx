import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useFinance } from "@/lib/finance-store";
import { buildFinanceContext } from "@/lib/finance-ai";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, TrendingUp, PiggyBank, AlertTriangle, ShoppingCart, Target } from "lucide-react";

export const Route = createFileRoute("/assistente")({
  head: () => ({ meta: [{ title: "Assistente IA — Finlux" }] }),
  component: Assistente,
});

const SUGGESTIONS = [
  { icon: TrendingUp, label: "Analise meus gastos do mês" },
  { icon: AlertTriangle, label: "Onde estou desperdiçando dinheiro?" },
  { icon: Sparkles, label: "Preveja meu saldo até o fim do mês" },
  { icon: ShoppingCart, label: "Posso comprar um celular de R$ 4.000?" },
  { icon: Target, label: "Quanto preciso investir para chegar a R$ 100 mil?" },
  { icon: PiggyBank, label: "Quanto devo guardar por mês?" },
];

function Assistente() {
  const state = useFinance();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const context = useMemo(() => buildFinanceContext(state), [state]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages, body }) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers: Record<string, string> = {};
          if (token) headers.Authorization = `Bearer ${token}`;
          return {
            body: { ...body, messages, context },
            headers,
          };
        },
      }),
    [context],
  );

  const STORAGE_KEY = "finlux:assistente:messages";
  const [initialMessages] = useState<UIMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as UIMessage[]) : [];
    } catch {
      return [];
    }
  });

  const { messages, sendMessage, status, error, stop, setMessages } = useChat({
    transport,
    messages: initialMessages,
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* noop */
    }
  }, [messages]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const [input, setInput] = useState("");

  function handleSend(message: PromptInputMessage) {
    const text = (message.text ?? input).trim();
    if (!text) return;
    sendMessage({ text });
    setInput("");
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function clearConversation() {
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <AppShell>
      <PageHeader subtitle="Inteligência financeira" title="Assistente IA" />
      {messages.length > 0 ? (
        <div className="px-6 -mt-4 mb-2 flex justify-end">
          <button
            type="button"
            onClick={clearConversation}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Limpar conversa
          </button>
        </div>
      ) : null}

      <div className="px-6 flex flex-col gap-4 h-[calc(100dvh-220px)] min-h-[420px]">
        <Conversation className="flex-1 rounded-3xl bg-card border border-border overflow-hidden">
          <ConversationContent className="px-4 py-4">
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<Sparkles className="h-8 w-8 text-primary" />}
                title="Como posso te ajudar hoje?"
                description="Analiso seus gastos, sugiro economias, projeto saldo e respondo dúvidas financeiras."
              >
                <div className="mt-4 grid gap-2 w-full">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => sendMessage({ text: s.label })}
                      className="flex items-center gap-3 rounded-2xl bg-card-elevated border border-border px-4 py-3 text-left text-sm text-foreground hover:border-primary transition-colors animate-in fade-in slide-in-from-bottom-1"
                    >
                      <s.icon className="h-4 w-4 text-primary shrink-0" />
                      <span className="flex-1">{s.label}</span>
                    </button>
                  ))}
                </div>
              </ConversationEmptyState>
            ) : (
              <>
                {messages.map((m) => {
                  const text = m.parts
                    .map((p) => (p.type === "text" ? p.text : ""))
                    .join("");
                  return (
                    <Message key={m.id} from={m.role === "user" ? "user" : "assistant"}>
                      <MessageContent>
                        {m.role === "assistant" ? (
                          <MessageResponse>{text}</MessageResponse>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm">{text}</p>
                        )}
                      </MessageContent>
                    </Message>
                  );
                })}
                {status === "submitted" ? (
                  <Message from="assistant">
                    <MessageContent>
                      <Shimmer>Pensando...</Shimmer>
                    </MessageContent>
                  </Message>
                ) : null}
              </>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {error ? (
          <div className="rounded-2xl bg-destructive/10 border border-destructive/30 px-4 py-2 text-xs text-destructive">
            {error.message || "Falha ao consultar o assistente."}
          </div>
        ) : null}

        <PromptInput onSubmit={handleSend} className="rounded-3xl">
          <PromptInputTextarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte algo sobre suas finanças..."
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit
              status={isLoading ? "streaming" : undefined}
              disabled={!input.trim() && !isLoading}
              onClick={isLoading ? (e) => { e.preventDefault(); stop(); } : undefined}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </AppShell>
  );
}
