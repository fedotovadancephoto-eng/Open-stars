export type FeedbackReply = {
  id: string;
  staff_name_snapshot: string;
  message: string;
  created_at: string;
};

export type ParentFeedback = {
  id: string;
  category: "app" | "education";
  message: string;
  status: "new" | "read" | "closed" | "archived";
  created_at: string;
  replies: FeedbackReply[];
};

export function feedbackDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}
