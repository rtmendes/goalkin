/** GoalKin word art: the "o" in goal is a calendar badge (green top, gold rings, coral check). */
export function Logo({ className = "h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 168 40" className={className} role="img" aria-label="GoalKin">
      <text x="0" y="31" fontFamily="var(--font-nunito), system-ui" fontWeight="900" fontSize="32" fill="currentColor">g</text>
      <g transform="translate(20 8)">
        <rect x="0" y="2" width="24" height="23" rx="5" fill="var(--surface)" stroke="currentColor" strokeWidth="2.5" />
        <path d="M0 7a5 5 0 0 1 5-5h14a5 5 0 0 1 5 5v2H0z" fill="#2F7D6D" />
        <rect x="5" y="-1" width="3" height="6" rx="1.5" fill="#C9A86A" />
        <rect x="16" y="-1" width="3" height="6" rx="1.5" fill="#C9A86A" />
        <path d="M6.5 16.5l3.5 3.5 7.5-7.5" fill="none" stroke="#FF6B4A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <text x="46" y="31" fontFamily="var(--font-nunito), system-ui" fontWeight="900" fontSize="32" fill="currentColor">al</text>
      <text x="76" y="31" fontFamily="var(--font-nunito), system-ui" fontWeight="900" fontSize="32" fill="#C9A86A">Kin</text>
    </svg>
  );
}
