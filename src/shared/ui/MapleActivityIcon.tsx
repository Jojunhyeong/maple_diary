import type { SVGProps } from 'react';

export function MapleActivityIcon({ kind, ...props }: SVGProps<SVGSVGElement> & {
  kind: 'meso' | 'hunting' | 'boss' | 'gathering' | 'expense';
}) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {kind === 'meso' && <><ellipse cx="12" cy="12" rx="8" ry="9" fill="currentColor" fillOpacity=".1" /><path d="M12 6v12M8.5 8.5H13a2.5 2.5 0 0 1 0 5H11a2 2 0 0 0 0 4h4M8.5 11V8.5" /></>}
      {kind === 'hunting' && <><path d="m7 15 9-11 4-1-1 5-10 9M5 13l6 6M7 17l-4 4M3 18l3 3" /><path d="m17 15 .5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5z" fill="currentColor" stroke="none" /></>}
      {kind === 'boss' && <><path d="M4 14c0-5 3-8 8-8s8 3 8 8v3c0 2-2 3-4 2l-4 1-4-1c-2 1-4 0-4-2z" fill="currentColor" fillOpacity=".1" /><path d="m8 7-1-4 5 3 5-3-1 4M10 17h4" /><circle cx="8.5" cy="12.5" r=".9" fill="currentColor" stroke="none" /><circle cx="15.5" cy="12.5" r=".9" fill="currentColor" stroke="none" /></>}
      {kind === 'gathering' && <><path d="M12 20v-8M12 14C5 15 3 11 4 6c5 0 9 2 8 8ZM12 11c0-5 3-7 8-7 1 5-2 9-8 8" fill="currentColor" fillOpacity=".1" /><path d="m7 9 5 5 5-7M8 21h8" /></>}
      {kind === 'expense' && <><path d="M4 7h14a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11v3" /><path d="M20 11h-6v5h6M16.5 13.5h1" /></>}
    </svg>
  );
}
