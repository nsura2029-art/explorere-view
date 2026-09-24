import type { ReactNode } from 'react';

/** Original, dependency-free glyphs (24×24, currentColor). */
export type IconName =
  | 'home' | 'user' | 'gear' | 'chart' | 'star' | 'heart' | 'folder' | 'grid'
  | 'search' | 'document' | 'users' | 'link' | 'pie';

function gearPath(): string {
  const cx = 12, cy = 12, teeth = 8, rOut = 10.4, rIn = 7.9, hole = 3.3;
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    const seg = [
      [a - step * 0.36, rIn], [a - step * 0.2, rOut], [a + step * 0.2, rOut], [a + step * 0.36, rIn],
    ];
    for (const [ang, r] of seg) pts.push(`${(cx + Math.cos(ang) * r).toFixed(2)} ${(cy + Math.sin(ang) * r).toFixed(2)}`);
  }
  const outer = `M${pts.join(' L')} Z`;
  const inner = `M${cx + hole} ${cy} A${hole} ${hole} 0 1 0 ${cx - hole} ${cy} A${hole} ${hole} 0 1 0 ${cx + hole} ${cy} Z`;
  return `${outer} ${inner}`;
}
const GEAR = gearPath();

const GLYPHS: Record<IconName, ReactNode> = {
  home: <path d="M12 3.2 2.9 10.9a1 1 0 0 0 .65 1.76H5V20a1 1 0 0 0 1 1h4.2v-5.2h3.6V21H18a1 1 0 0 0 1-1v-7.34h1.45a1 1 0 0 0 .65-1.76Z" />,
  user: (
    <>
      <circle cx="12" cy="7.8" r="4.3" />
      <path d="M3.8 20.1c.7-4 4.1-6.6 8.2-6.6s7.5 2.6 8.2 6.6a.9.9 0 0 1-.9 1.1H4.7a.9.9 0 0 1-.9-1.1Z" />
    </>
  ),
  gear: <path d={GEAR} fillRule="evenodd" />,
  chart: (
    <>
      <rect x="3.5" y="13" width="4.4" height="8" rx="1.2" />
      <rect x="9.8" y="8.2" width="4.4" height="12.8" rx="1.2" />
      <rect x="16.1" y="3" width="4.4" height="18" rx="1.2" />
    </>
  ),
  star: <path d="m12 2.4 2.95 6.05 6.65.93-4.84 4.66 1.18 6.62L12 17.5l-5.94 3.16 1.18-6.62L2.4 9.38l6.65-.93Z" strokeLinejoin="round" />,
  heart: <path d="M12 20.8S3.2 15.5 3.2 9.4A5 5 0 0 1 12 6.2a5 5 0 0 1 8.8 3.2c0 6.1-8.8 11.4-8.8 11.4Z" />,
  folder: <path d="M2.8 6.4A1.6 1.6 0 0 1 4.4 4.8h4.8l2.1 2.3h8.3a1.6 1.6 0 0 1 1.6 1.6v10a1.6 1.6 0 0 1-1.6 1.6H4.4a1.6 1.6 0 0 1-1.6-1.6Z" />,
  grid: (
    <>
      <rect x="3.2" y="3.2" width="7.6" height="7.6" rx="1.8" />
      <rect x="13.2" y="3.2" width="7.6" height="7.6" rx="1.8" />
      <rect x="3.2" y="13.2" width="7.6" height="7.6" rx="1.8" />
      <rect x="13.2" y="13.2" width="7.6" height="7.6" rx="1.8" />
    </>
  ),
  search: (
    <>
      <circle cx="10.2" cy="10.2" r="6.2" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <path d="m14.8 14.8 5.6 5.6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  document: (
    <>
      <path d="M6.2 2.6h7.9l5 5V20a1.4 1.4 0 0 1-1.4 1.4H6.2A1.4 1.4 0 0 1 4.8 20V4a1.4 1.4 0 0 1 1.4-1.4Z" />
      <path d="M8 12h8M8 15.2h8M8 18.4h5" stroke="rgba(10,10,40,.55)" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  users: (
    <>
      <circle cx="12" cy="7.2" r="3.4" />
      <circle cx="5.2" cy="9" r="2.5" />
      <circle cx="18.8" cy="9" r="2.5" />
      <path d="M6.2 19.8c.4-3.4 2.9-5.6 5.8-5.6s5.4 2.2 5.8 5.6a.8.8 0 0 1-.8.9H7a.8.8 0 0 1-.8-.9Z" />
      <path d="M1.4 18.4c.2-2.6 1.8-4.2 3.8-4.2 1 0 1.9.3 2.5.9-1 1-1.7 2.3-2 3.9H2.2a.8.8 0 0 1-.8-.6ZM22.6 18.4c-.2-2.6-1.8-4.2-3.8-4.2-1 0-1.9.3-2.5.9 1 1 1.7 2.3 2 3.9h3.5a.8.8 0 0 0 .8-.6Z" />
    </>
  ),
  link: (
    <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" transform="rotate(-45 12 12)">
      <rect x="1.6" y="8.4" width="10.4" height="7.2" rx="3.6" />
      <rect x="12" y="8.4" width="10.4" height="7.2" rx="3.6" />
      <path d="M8 12h8" />
    </g>
  ),
  pie: (
    <>
      <path d="M10.8 3.4a8.8 8.8 0 1 0 9.8 9.8h-9.8Z" />
      <path d="M13 1.4v9.8h9.8A9.8 9.8 0 0 0 13 1.4Z" />
    </>
  ),
};

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[name]}
    </svg>
  );
}
