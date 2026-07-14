// TEMPORARY in-platform chat room (Phase-1 coordination) — the core surface,
// rendered full-page by ChatPage. Messages are shared via Supabase (polled),
// with a localStorage fallback offline. Multi-line composer (Enter sends,
// Shift+Enter inserts a new line). Autoscroll only follows new messages when
// you're already at the bottom, so it won't yank you down while reading history.

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "./ui";
import { useApp } from "@/state/AppContext";
import { fetchChatMessages, sendChatMessage } from "@/data/repository";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/data/types";

const NAME_KEY = "chat_display_name";
export const chatSeenKey = (t: string) => `chat_seen_${t}`;
const POLL_MS = 4000;

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatRoom({ className }: { className?: string }) {
  const { tenant } = useApp();
  const tenantId = tenant?.id ?? "";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [name, setName] = useState(
    () => (typeof localStorage !== "undefined" && localStorage.getItem(NAME_KEY)) || ""
  );
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true); // is the list currently scrolled to the bottom?
  const taRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(() => {
    if (!tenantId) return;
    fetchChatMessages(tenantId)
      .then((m) => {
        setMessages(m);
        // Viewing the room marks everything as seen (clears the launcher badge).
        localStorage.setItem(chatSeenKey(tenantId), String(m.length));
      })
      .catch(() => {});
  }, [tenantId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Follow new messages ONLY when already pinned to the bottom.
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const autoGrow = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  };

  const send = async () => {
    const body = draft.trim();
    const sender = name.trim() || "Guest";
    if (!body || !tenantId || sending) return;
    localStorage.setItem(NAME_KEY, sender);
    setSending(true);
    setDraft("");
    atBottomRef.current = true; // sending your own message jumps to the bottom
    if (taRef.current) taRef.current.style.height = "auto";
    try {
      await sendChatMessage({ tenant_id: tenantId, sender, body });
      await load();
    } catch {
      setDraft(body); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const myName = name.trim() || "Guest";

  return (
    <Card className={cn("flex flex-col overflow-hidden p-0", className)}>
      {/* Identity + temporary marker */}
      <div className="flex items-center gap-2 border-b border-line px-4 py-2">
        <span className="shrink-0 text-xs text-muted">You:</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="h-8 w-44 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
        <span className="ml-auto shrink-0 rounded-md bg-amber/10 px-2 py-0.5 text-[11px] font-medium text-amber">
          Temporary · Phase-1
        </span>
      </div>

      {/* Message history */}
      <div ref={listRef} onScroll={onScroll} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted">No messages yet — say hello 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender === myName;
            return (
              <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                    mine
                      ? "rounded-br-sm bg-brand text-brand-fg"
                      : "rounded-bl-sm bg-canvas text-ink"
                  )}
                >
                  {!mine && (
                    <p className="mb-0.5 text-[11px] font-semibold text-muted">{m.sender}</p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
                <span className="mt-0.5 px-1 text-[10px] text-muted">{fmtTime(m.created_at)}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Multi-line composer */}
      <div className="flex items-end gap-2 border-t border-line p-3">
        <textarea
          ref={taRef}
          value={draft}
          rows={1}
          onChange={(e) => {
            setDraft(e.target.value);
            autoGrow();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a message…  (Enter to send · Shift+Enter for a new line)"
          className="max-h-[120px] min-h-[2.25rem] flex-1 resize-none rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
        <button
          onClick={send}
          disabled={!draft.trim() || sending}
          className="inline-flex h-9 shrink-0 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-fg hover:opacity-90 disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </Card>
  );
}
