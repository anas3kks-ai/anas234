"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquarePlus,
  LogOut,
  Trash2,
  Sparkles,
} from "lucide-react";
import { api, getToken, type Conversation, type Message, type User } from "@/lib/api";
import { ChatThread } from "@/components/chat-thread";
import { ActivityPanel, type ActivityEvent } from "@/components/activity-panel";
import { cn } from "@/lib/utils";

type Pending = {
  toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[];
};

export function ChatApp({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);

  const refreshConversations = useCallback(async () => {
    const list = await api.listConversations();
    setConversations(list);
    return list;
  }, []);

  useEffect(() => {
    refreshConversations().then((list) => {
      if (list.length > 0) setActiveId(list[0].id);
    });
  }, [refreshConversations]);

  useEffect(() => {
    if (activeId == null) {
      setMessages([]);
      setActivity([]);
      return;
    }
    api.getMessages(activeId).then(setMessages).catch(() => setMessages([]));
    setActivity([]);
  }, [activeId]);

  useEffect(() => {
    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, []);

  async function newConversation() {
    const c = await api.createConversation();
    setConversations((prev) => [c, ...prev]);
    setActiveId(c.id);
  }

  async function deleteConversation(id: number) {
    await api.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  async function sendMessage(text: string) {
    let convId = activeId;
    if (convId == null) {
      const c = await api.createConversation();
      setConversations((prev) => [c, ...prev]);
      convId = c.id;
      setActiveId(c.id);
    }
    if (!convId) return;

    setPendingUser(text);
    await api.postUserMessage(convId, text);
    setPendingUser(null);

    const tok = getToken();
    if (!tok) return;

    const msgs = await api.getMessages(convId);
    setMessages(msgs);

    setStreaming(true);
    setStatus("connecting…");
    setActivity([]);

    const es = new EventSource(api.streamUrl(convId, tok));
    esRef.current = es;

    const handle = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        handleEvent(data, convId!);
      } catch (err) {
        console.error("parse error", err);
      }
    };

    ["status", "assistant_message", "tool_call", "tool_result", "error", "done", "message"].forEach(
      (t) => es.addEventListener(t, handle as EventListener)
    );

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setStreaming(false);
      setStatus("");
    };
  }

  function handleEvent(
    e: { type: string; [k: string]: unknown },
    convId: number
  ) {
    if (e.type === "status") {
      setStatus(String(e.message ?? ""));
      return;
    }
    if (e.type === "assistant_message") {
      setMessages((prev) => [
        ...prev,
        {
          id: Number(e.id ?? Date.now()),
          role: "assistant",
          content: String(e.content ?? ""),
          tool_calls_json: null,
          tool_call_id: null,
          name: null,
          created_at: new Date().toISOString(),
        },
      ]);
      return;
    }
    if (e.type === "tool_call") {
      setActivity((prev) => [
        ...prev,
        {
          kind: "tool_call",
          id: String(e.id ?? Date.now()),
          name: String(e.name ?? ""),
          args: (e.arguments as Record<string, unknown>) ?? {},
          createdAt: Date.now(),
        },
      ]);
      return;
    }
    if (e.type === "tool_result") {
      setActivity((prev) => [
        ...prev,
        {
          kind: "tool_result",
          id: `${e.tool_call_id}-res`,
          toolCallId: String(e.tool_call_id ?? ""),
          name: String(e.name ?? ""),
          result: (e.result as Record<string, unknown>) ?? {},
          createdAt: Date.now(),
        },
      ]);
      return;
    }
    if (e.type === "error") {
      setActivity((prev) => [
        ...prev,
        {
          kind: "error",
          id: `err-${Date.now()}`,
          message: String(e.message ?? "unknown error"),
          createdAt: Date.now(),
        },
      ]);
      setStreaming(false);
      return;
    }
    if (e.type === "done") {
      setStreaming(false);
      setStatus("");
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      api.getMessages(convId).then(setMessages).catch(() => {});
      refreshConversations();
    }
  }

  const visibleMessages = useMemo(() => {
    const base = messages.filter((m) => m.role === "user" || m.role === "assistant");
    if (pendingUser) {
      base.push({
        id: -1,
        role: "user",
        content: pendingUser,
        tool_calls_json: null,
        tool_call_id: null,
        name: null,
        created_at: new Date().toISOString(),
      });
    }
    return base;
  }, [messages, pendingUser]);

  return (
    <div className="h-screen grid grid-cols-[280px_1fr_420px] overflow-hidden">
      {/* Sidebar */}
      <aside className="border-r border-line bg-panel flex flex-col min-h-0">
        <div className="px-4 py-4 flex items-center gap-2 border-b border-line">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="font-semibold">Omni</div>
        </div>

        <button
          onClick={newConversation}
          className="mx-3 mt-3 flex items-center justify-center gap-2 py-2 rounded-lg bg-soft border border-line hover:border-accent text-sm transition"
        >
          <MessageSquarePlus className="w-4 h-4" />
          New chat
        </button>

        <div className="flex-1 overflow-y-auto mt-3 px-2 pb-3 min-h-0">
          {conversations.length === 0 && (
            <div className="text-xs text-muted px-3 py-2">No chats yet</div>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={cn(
                "group flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm mb-0.5",
                activeId === c.id
                  ? "bg-soft text-ink"
                  : "text-muted hover:bg-soft/60 hover:text-ink"
              )}
            >
              <span className="truncate flex-1">{c.title || "Untitled"}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Delete this chat?")) deleteConversation(c.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-line px-3 py-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-soft flex items-center justify-center text-xs font-semibold">
            {(user.name || user.email).slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">{user.name || user.email}</div>
            <div className="text-xs text-muted truncate">{user.email}</div>
          </div>
          <button
            onClick={onSignOut}
            className="text-muted hover:text-ink p-1.5 rounded-md hover:bg-soft"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Chat */}
      <main className="flex flex-col min-h-0 bg-bg">
        <ChatThread
          messages={visibleMessages}
          streaming={streaming}
          status={status}
          onSend={sendMessage}
          emptyStateName={user.name}
        />
      </main>

      {/* Activity */}
      <aside className="border-l border-line bg-panel min-h-0 overflow-hidden">
        <ActivityPanel events={activity} streaming={streaming} status={status} />
      </aside>
    </div>
  );
}
