import { FileCheck2, CircleDot, CheckCircle2, ServerOff, ShieldCheck, Ban } from 'lucide-react';
import type { AuditEvent, AuditKind } from '@/lib/types';
import { Card, Pill, cn } from './ui';

const ICONS: Record<AuditKind, React.ElementType> = {
  requested: CircleDot,
  approved: CheckCircle2,
  'node-offline': ServerOff,
  'node-online': ServerOff,
  blocked: Ban,
  executed: ShieldCheck,
};

const TONE: Record<AuditKind, string> = {
  requested: 'bg-white/5 text-slate-400',
  approved: 'bg-emerald-500/15 text-emerald-300',
  'node-offline': 'bg-red-500/15 text-red-300',
  'node-online': 'bg-white/5 text-slate-400',
  blocked: 'bg-amber-500/15 text-amber-300',
  executed: 'bg-brand-500/15 text-brand-400',
};

// Auditability: every request, approval, hosting change and execution is
// captured as an ordered, traceable record.
export function AuditTrail({ events, note }: { events: AuditEvent[]; note?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200">
          <FileCheck2 size={15} className="text-brand-400" /> Audit trail
        </span>
        <div className="flex items-center gap-2">
          {note && (
            <span className="hidden font-mono text-[10px] uppercase tracking-wider text-emerald-400 sm:inline">
              {note}
            </span>
          )}
          <Pill>{events.length} events</Pill>
        </div>
      </div>

      <ol className="mt-4 space-y-px">
        {events.map((e, i) => {
          const I = ICONS[e.kind];
          return (
            <li key={e.id} className="relative flex items-center gap-3 py-2.5">
              {i < events.length - 1 && (
                <span className="absolute left-[15px] top-9 h-[calc(100%-1rem)] w-px bg-white/8" />
              )}
              <span className={cn('z-10 grid h-8 w-8 flex-none place-items-center rounded-lg', TONE[e.kind])}>
                <I size={14} />
              </span>
              <span className="flex-1">
                <b className="block text-[13px] text-slate-100">{e.label}</b>
                {e.detail && <small className="block font-mono text-[11px] text-slate-500">{e.detail}</small>}
              </span>
              {e.actor && (
                <span className="rounded-full bg-white/5 px-2.5 py-1 font-mono text-[10px] font-medium text-slate-400">
                  {e.actor}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
