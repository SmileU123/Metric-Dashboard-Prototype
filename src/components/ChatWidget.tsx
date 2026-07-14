// TEMPORARY chat entry points (Phase-1 coordination): a refresh notification and
// a floating launcher, both leading to the /chat page. The actual chat surface
// lives in ChatRoom / ChatPage. Hidden while already on the chat page.

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "@/state/AppContext";
import { fetchChatMessages } from "@/data/repository";
import { chatSeenKey } from "./ChatRoom";

const POLL_MS = 4000;

export function ChatWidget() {
  const { tenant } = useApp();
  const tenantId = tenant?.id ?? "";
  const navigate = useNavigate();
  const location = useLocation();
  const onChatPage = location.pathname === "/chat";

  const [notif, setNotif] = useState(true); // re-shown on every mount / refresh
  const [unread, setUnread] = useState(0);

  // Poll the message count and compare with what's been seen to badge unread.
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    const poll = () =>
      fetchChatMessages(tenantId)
        .then((m) => {
          if (cancelled) return;
          const seen = Number(localStorage.getItem(chatSeenKey(tenantId)) || 0);
          setUnread(Math.max(0, m.length - seen));
        })
        .catch(() => {});
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tenantId]);

  // Visiting the chat page dismisses the notification.
  useEffect(() => {
    if (onChatPage) setNotif(false);
  }, [onChatPage]);

  const go = () => {
    setNotif(false);
    navigate("/chat");
  };

  if (onChatPage) return null;

  return (
    <>
      {/* Refresh notification — nudges to the chat, states it's temporary */}
      {notif && (
        <div className="fixed bottom-24 right-6 z-40 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-line bg-surface p-4 shadow-xl">
          <button
            onClick={() => setNotif(false)}
            aria-label="Dismiss"
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-canvas"
          >
            ✕
          </button>
          <p className="pr-5 text-sm font-semibold text-ink">💬 Team chat is available</p>
          <p className="mt-1 text-xs text-muted">
            A quick in-platform chat so we can coordinate directly. Open the chat
            page to read messages and reply.
          </p>
          <p className="mt-2 rounded-md bg-amber/10 px-2 py-1 text-[11px] font-medium text-amber">
            Temporary feature — for Phase-1 coordination only.
          </p>
          <button
            onClick={go}
            className="mt-3 w-full rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg hover:opacity-90"
          >
            Open chat
          </button>
        </div>
      )}

      {/* Floating launcher */}
      <button
        onClick={go}
        aria-label="Open team chat"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-fg shadow-lg transition-transform hover:scale-105"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red px-1 text-xs font-semibold text-white">
            {unread}
          </span>
        )}
      </button>
    </>
  );
}
