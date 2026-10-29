// Short status messages passed through the URL as a code (never as free text, so a
// link cannot put arbitrary words on the page).

export const NOTICES = {
  created: ["info", "Circle created. Share the invite link to bring people in."],
  joined: ["info", "You're in. Welcome to the circle."],
  already: ["info", "You're already in this circle."],
  full: ["warn", "This circle is full. Ask the leader to make room."],
  left: ["info", "You left the circle. Your goals there are private again."],
  removed: ["info", "Member removed. Their goals are no longer shared here."],
  regenerated: ["info", "New invite link made. The old link no longer works."],
  invited: ["info", "Invite ready. Copy the link below and send it your way."],
  sent: ["info", "Sent. Nice one."],
  dare: ["info", "Dare proposed. It only counts once they accept it."],
  meetup: ["info", "Meetup added."],
  meetup_removed: ["info", "Meetup removed."],
  goal_attached: ["info", "Shared goal set. Choose what the circle sees on the share screen."],
  need_plan: ["warn", "Leading a circle needs Pro or higher."],
  need_focus_plan: ["warn", "Hosting a focus room needs Pro or higher. You can still join rooms you're invited to."],
  not_member: ["warn", "That's only for members of this circle."],
  not_visible: ["warn", "You can only dare someone on a goal they share with you."],
  invalid: ["warn", "Something in that form didn't look right. Please check and try again."],
  failed: ["warn", "That didn't save. Please try again in a moment."],
  bad_code: ["warn", "That code didn't match a room. Check it and try again."],
  room_joined: ["info", "You joined the room."],
  saved: ["info", "Saved."],
  leader_stays: ["warn", "Leaders can't leave their own circle. You can delete it instead."],
  deleted: ["info", "Circle deleted."],
} as const satisfies Record<string, readonly ["info" | "warn", string]>;

export type NoticeCode = keyof typeof NOTICES;

export function noticeFor(code: string | string[] | undefined): { tone: "info" | "warn"; text: string } | null {
  const c = Array.isArray(code) ? code[0] : code;
  if (!c || !(c in NOTICES)) return null;
  const [tone, text] = NOTICES[c as NoticeCode];
  return { tone, text };
}
