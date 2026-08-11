import { useState } from "react";
import Button from "../ui/Button.jsx";

const REPLY_FALLBACK_NAME = {
  admin: "TableSpot Admin",
  owner: "Restaurant Owner",
  customer: "Customer",
};

export default function WarningConversation({
  warning,
  canReply,
  onReply,
  placeholder = "Reply to the admin regarding this warning...",
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const replies = warning.replies || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    setSending(true);
    try {
      await onReply(text);
      setMessage("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
        Conversation ({replies.length})
      </p>

      {replies.length === 0 ? (
        <p className="text-sm text-muted">No replies yet.</p>
      ) : (
        <div className="space-y-2">
          {replies.map((reply) => (
            <div
              key={reply._id || reply.createdAt}
              className={`rounded-lg border p-3 text-sm ${
                reply.role === "admin"
                  ? "border-primary/20 bg-primary/5"
                  : "border-border bg-muted/20"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-text">
                  {reply.fullName || REPLY_FALLBACK_NAME[reply.role] || reply.role}
                  <span className="ml-2 text-xs font-medium text-muted capitalize">
                    {reply.role}
                  </span>
                </p>
                <p className="text-xs text-muted">
                  {reply.createdAt ? new Date(reply.createdAt).toLocaleString() : ""}
                </p>
              </div>
              <p className="mt-1 text-text/80">{reply.message}</p>
            </div>
          ))}
        </div>
      )}

      {canReply && (
        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <textarea
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={placeholder}
            maxLength={1000}
            className="input-field w-full"
          />
          <Button type="submit" size="sm" isLoading={sending} className="self-end">
            Reply
          </Button>
        </form>
      )}
    </div>
  );
}
