import { CheckCircle2, Circle, LockKeyhole } from 'lucide-react';
import type { DemoApplication } from '@/lib/types';
import { approvalsMet } from '@/lib/engine';
import { Card, Pill, cn } from './ui';

// Shared control: a privileged action held behind a party quorum.
export function SharedControl({
  app,
  approvals,
  locked,
  onToggle,
}: {
  app: DemoApplication;
  approvals: string[];
  locked: boolean;
  onToggle: (partyId: string) => void;
}) {
  const met = approvalsMet(app, { approvals, offlineNodes: [], walletConnected: false, executed: false });
  const pct = Math.min(100, (approvals.length / app.threshold) * 100);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200">
          <LockKeyhole size={15} className="text-brand-400" /> Shared control
        </span>
        <Pill tone={met ? 'emerald' : 'amber'}>{met ? 'Quorum met' : 'Awaiting approval'}</Pill>
      </div>

      <div className="mt-5 font-mono text-[11px] font-semibold tracking-[0.14em] text-brand-400">
        {app.action.verb}
      </div>
      <div className="mt-1 text-3xl font-semibold tracking-tight text-white">
        {app.action.primary}
      </div>

      <dl className="mt-4 space-y-px">
        <Row label="From" value={app.action.from} />
        <Row label="To" value={app.action.to} mono />
        <Row label="Reference" value={app.action.reference} mono />
      </dl>

      <p className="mt-4 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-xs text-slate-400">
        {app.action.detail}
      </p>

      <div className="mt-4 space-y-2">
        {app.parties.map((p) => {
          const ok = approvals.includes(p.id);
          return (
            <button
              key={p.id}
              disabled={locked}
              onClick={() => onToggle(p.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70',
                ok
                  ? 'border-emerald-500/25 bg-emerald-500/[0.06]'
                  : 'border-white/8 bg-white/[0.02] hover:border-white/20',
              )}
            >
              <span
                className={cn(
                  'grid h-8 w-8 flex-none place-items-center rounded-full text-xs font-bold',
                  ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-brand-500/15 text-brand-400',
                )}
              >
                {p.name[0]}
              </span>
              <span className="flex-1">
                <b className="block text-[13px] text-slate-100">{p.name}</b>
                <small className="block font-mono text-[10px] text-slate-500">{p.role}</small>
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-medium',
                  ok ? 'text-emerald-300' : 'text-slate-400',
                )}
              >
                {ok ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                {ok ? 'Approved' : 'Approve'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-brand-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-300">
          {approvals.length} of {app.threshold} required
        </span>
        <span className="font-mono text-slate-500">{app.parties.length} eligible parties</span>
      </div>
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] py-2.5 text-[13px] last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn('text-slate-200', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  );
}
