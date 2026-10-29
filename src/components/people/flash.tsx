import { Notice } from "@/components/ui";
import { noticeFor } from "@/lib/people/notices";

export function Flash({ code }: { code: string | string[] | undefined }) {
  const n = noticeFor(code);
  if (!n) return null;
  return (
    <div role="status" className="mb-4">
      <Notice tone={n.tone}>{n.text}</Notice>
    </div>
  );
}
