"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/lib/api";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "تصفح hackernews.com وأعطني أهم 5 قصص اليوم",
  "اكتب كود Python يحسب أول 100 رقم أولي ونفّذه",
  "التقط screenshot لموقع example.com",
  "تذكّر أنني أفضّل الردود باللغة العربية",
];

export function ChatThread({
  messages,
  streaming,
  status,
  onSend,
  emptyStateName,
}: {
  messages: Message[];
  streaming: boolean;
  status: string;
  onSend: (text: string) => void | Promise<void>;
  emptyStateName?: string;
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streaming, status]);

  async function submit() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await onSend(text);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 pt-6 pb-40">
          {messages.length === 0 ? (
            <div className="mt-20 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-accent2 mb-5">
                <span className="text-2xl">✨</span>
              </div>
              <h1 className="text-2xl font-semibold mb-2">
                Hi{emptyStateName ? ` ${emptyStateName}` : ""}, what can I do today?
              </h1>
              <p className="text-muted text-sm mb-8">
                I can browse the web, run code, edit files, send emails, and more.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-start text-sm px-4 py-3 rounded-xl border border-line bg-panel hover:border-accent/60 hover:bg-soft transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((m) => (
                <MessageBubble key={`${m.id}-${m.role}`} message={m} />
              ))}
              {streaming && (
                <div className="flex items-center gap-2 text-sm text-muted ms-1">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  {status && <span>{status}</span>}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-line bg-bg/60 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="relative rounded-2xl border border-line bg-panel focus-within:border-accent/60 transition">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 200) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Ask Omni anything — browse, code, files, email…"
              className="w-full resize-none bg-transparent px-4 py-3.5 pr-14 text-sm outline-none placeholder:text-muted"
            />
            <button
              onClick={submit}
              disabled={!input.trim() || streaming}
              className={cn(
                "absolute end-2 bottom-2 w-9 h-9 rounded-xl flex items-center justify-center transition",
                !input.trim() || streaming
                  ? "bg-soft text-muted"
                  : "bg-gradient-to-br from-accent to-accent2 text-white hover:opacity-90"
              )}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
          <div className="text-[11px] text-muted mt-2 text-center">
            Enter to send · Shift+Enter for newline
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent2 shrink-0 mt-0.5" />
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-[14.5px]",
          isUser
            ? "bg-gradient-to-br from-accent to-accent2 text-white rounded-tr-sm"
            : "bg-panel border border-line text-ink rounded-tl-sm prose-chat"
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content || "*(thinking…)*"}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
