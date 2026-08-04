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
import { buildFinanceContext, buildFinanceFacts, suggestedQuestions } from "@/lib/finance-ai";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, TrendingUp, PiggyBank, AlertTriangle, ShoppingCart, Target } from "lucide-react";

export const Route = createFileRoute("/assistente")({
  head: () => ({
    meta: [
      { title: "Lux IA — seu parceiro financeiro | Finlux" },
      {
        name: "description",
        content:
          "Converse com o Lux IA: análises de gastos, projeções de saldo e recomendações financeiras personalizadas no Finlux.",
      },
      { property: "og:title", content: "Lux IA — seu parceiro financeiro" },
      {
        property: "og:description",
        content: "Assistente financeiro inteligente do Finlux, com análises e recomendações personalizadas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Assistente,
});

/** Escolhe um ícone coerente com o tema da sugestão. */
function iconFor(label: string) {
  const l = label.toLowerCase();
  if (l.includes("desperdi") || l.includes("reduzir") || l.includes("negativo")) return AlertTriangle;
  if (l.includes("investir") || l.includes("investimento") || l.includes("atingir")) return Target;
  if (l.includes("guardar") || l.includes("reserva")) return PiggyBank;
  if (l.includes("comprar") || l.includes("gastar")) return ShoppingCart;
  if (l.includes("saldo") || l.includes("preveja") || l.includes("score")) return Sparkles;
  return TrendingUp;
}

function Assistente() {
  const state = useFinance();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const context = useMemo(() => buildFinanceContext(state), [state]);
  const facts = useMemo(() => buildFinanceFacts(state), [state]);
  const suggestions = useMemo(() => suggestedQuestions(state, new Date(), 6), [state]);
  const quickActions = useMemo(() => suggestedQuestions(state, new Date(), 3), [state]);

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
            body: { ...body, messages, context, facts },
            headers,
          };
        },
      }),
    [context, facts],
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
      <PageHeader subtitle="Seu parceiro financeiro" title="Lux IA" />
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
                icon={<LuxAvatar emotion="recepcionando" size={96} />}
                title="Oi! Sou o Lux."
                description="Analiso seus gastos, sugiro economias, projeto seu saldo e explico finanças de forma simples."
              >
                <div className="mt-4 grid gap-2 w-full">
                  {suggestions.map((label) => {
                    const Icon = iconFor(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => sendMessage({ text: label })}
                        className="flex items-center gap-3 rounded-2xl bg-card-elevated border border-border px-4 py-3 text-left text-sm text-foreground hover:border-primary transition-colors animate-in fade-in slide-in-from-bottom-1"
                      >
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <span className="flex-1">{label}</span>
                      </button>
                    );
                  })}
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
                      <span className="flex items-center gap-2">
                        <LuxAvatar emotion="processando" size={28} particles={false} />
                        <Shimmer>Pensando...</Shimmer>
                      </span>
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

        {messages.length > 0 && !isLoading ? (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {quickActions.map((label) => {
              const Icon = iconFor(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => sendMessage({ text: label })}
                  className="flex items-center gap-1.5 shrink-0 rounded-full bg-card-elevated border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary transition-colors"
                >
                  <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                  {label}
                </button>
              );
            })}
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
