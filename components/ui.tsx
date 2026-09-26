import type { ReactNode } from 'react';

export const cn = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

export const CARD =
  'rounded-2xl border border-white/8 bg-white/[0.02] backdrop-blur-sm';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(CARD, className)}>{children}</div>;
}

type Tone = 'neutral' | 'emerald' | 'amber' | 'red' | 'brand';

const TONES: Record<Tone, string> = {
  neutral: 'border-white/10 bg-white/5 text-slate-400',
  emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  amber: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  red: 'border-red-500/25 bg-red-500/10 text-red-300',
  brand: 'border-brand-500/30 bg-brand-500/10 text-brand-400',
};

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.12em] uppercase',
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Eyebrow({ children, light }: { children: ReactNode; light?: boolean }) {
  return (
    <div
      className={cn(
        'mb-3 font-mono text-[11px] font-semibold tracking-[0.2em] uppercase',
        light ? 'text-brand-400' : 'text-slate-500',
      )}
    >
      {children}
    </div>
  );
}
