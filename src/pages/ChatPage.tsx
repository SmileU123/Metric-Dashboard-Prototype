// Team Chat page — the temporary in-platform chat as a first-class screen.

import { PageHeader } from "@/components/ui";
import { ChatRoom } from "@/components/ChatRoom";

export function ChatPage() {
  return (
    <div>
      <PageHeader
        title="Team Chat"
        subtitle="Temporary in-platform chat for Phase-1 coordination — messages are shared with everyone viewing this tenant."
      />
      <ChatRoom className="h-[calc(100vh-13rem)] min-h-[24rem]" />
    </div>
  );
}
