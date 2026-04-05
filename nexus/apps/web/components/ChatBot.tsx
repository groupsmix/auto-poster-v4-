"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { ChatAction, ChatActionResult } from "@nexus/shared";

// ============================================================
// ChatBot — Floating AI Business Partner Widget
// ============================================================

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposed_actions?: ChatAction[];
  action_results?: ChatActionResult[];
  isLoading?: boolean;
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [executingActions, setExecutingActions] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Rate limiting: track last send time to prevent rapid-fire submissions (code-review #17)
  const lastSendRef = useRef<number>(0);
  const CHAT_RATE_LIMIT_MS = 2000; // 2 seconds between messages

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Send message
  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    // Rate limit: prevent rapid-fire submissions
    const now = Date.now();
    if (now - lastSendRef.current < CHAT_RATE_LIMIT_MS) return;
    lastSendRef.current = now;

    const userMsg: LocalMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    const loadingMsg: LocalMessage = {
      id: `loading-${Date.now()}`,
      role: "assistant",
      content: "",
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const resp = await api.chatbot.chat(trimmed, conversationId);

      if (resp.success && resp.data) {
        const data = resp.data;
        setConversationId(data.conversation_id);

        const assistantMsg: LocalMessage = {
          id: data.message.id,
          role: "assistant",
          content: data.message.content,
          proposed_actions: data.pending_actions,
        };

        setMessages((prev) =>
          prev.filter((m) => !m.isLoading).map((m) =>
            m.id === userMsg.id ? { ...m, id: m.id } : m
          ).concat(
            prev.some((m) => m.id === assistantMsg.id) ? [] : []
          )
        );
        // Replace loading message with actual response
        setMessages((prev) => [
          ...prev.filter((m) => !m.isLoading),
          assistantMsg,
        ]);
      } else {
        setMessages((prev) => [
          ...prev.filter((m) => !m.isLoading),
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Sorry, something went wrong: ${resp.error ?? "Unknown error"}. Try again.`,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev.filter((m) => !m.isLoading),
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Connection error. Please check your network and try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, conversationId]);

  // Execute actions
  const executeActions = useCallback(
    async (messageId: string, actions: ChatAction[]) => {
      if (!conversationId) return;

      const actionIds = actions.map((a) => a.id);
      setExecutingActions((prev) => new Set([...prev, ...actionIds]));

      try {
        const resp = await api.chatbot.execute(
          conversationId,
          messageId,
          actionIds
        );

        if (resp.success && resp.data) {
          // Add summary message
          const summaryMsg: LocalMessage = {
            id: resp.data.summary_message.id,
            role: "assistant",
            content: resp.data.summary_message.content,
            action_results: resp.data.results,
          };

          // Update the original message to show executed state
          setMessages((prev) => [
            ...prev.map((m) =>
              m.id === messageId
                ? { ...m, action_results: resp.data!.results }
                : m
            ),
            summaryMsg,
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant" as const,
            content: "Failed to execute actions. Please try again.",
          },
        ]);
      } finally {
        setExecutingActions((prev) => {
          const next = new Set(prev);
          actionIds.forEach((id) => next.delete(id));
          return next;
        });
      }
    },
    [conversationId]
  );

  // New conversation
  const newConversation = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
  }, []);

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating chat button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-accent text-white shadow-lg hover:bg-accent/90 transition-all duration-200 flex items-center justify-center group"
        aria-label="Open AI Chatbot"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-8rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">NEXUS AI</h3>
                <p className="text-xs text-muted-foreground">Your business partner</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={newConversation}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                title="New conversation"
              >
                <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                title="Close"
              >
                <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">Hey, what&apos;s up?</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  I&apos;m your AI business partner. Tell me what you want to build, and I&apos;ll help you set it up. Or just brainstorm — your call.
                </p>
                <div className="grid grid-cols-1 gap-2 w-full">
                  {[
                    "I want to add a new niche",
                    "What domains do I have?",
                    "Help me brainstorm a product idea",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className="text-left text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] ${msg.role === "user" ? "order-1" : ""}`}>
                  {/* Message bubble */}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-accent text-white rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.isLoading ? (
                      <div className="flex items-center gap-1.5 py-1">
                        <div className="w-2 h-2 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                  </div>

                  {/* Proposed actions */}
                  {msg.proposed_actions && msg.proposed_actions.length > 0 && !msg.action_results && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-muted-foreground font-medium px-1">
                        Proposed actions:
                      </p>
                      {msg.proposed_actions.map((action) => (
                        <div
                          key={action.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{action.label}</p>
                            <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                          </div>
                          {executingActions.has(action.id) ? (
                            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
                          ) : null}
                        </div>
                      ))}
                      <button
                        onClick={() => executeActions(msg.id, msg.proposed_actions!)}
                        disabled={executingActions.size > 0}
                        className="w-full mt-1 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {executingActions.size > 0 ? "Executing..." : "Apply All"}
                      </button>
                    </div>
                  )}

                  {/* Action results */}
                  {msg.action_results && msg.action_results.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {msg.action_results.map((result) => (
                        <div
                          key={result.action_id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                            result.success
                              ? "bg-green-500/10 text-green-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {result.success ? (
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          <span className="truncate">{result.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-border px-4 py-3 bg-card">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tell me what you want to do..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 max-h-32"
                style={{ minHeight: "42px" }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="shrink-0 w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
