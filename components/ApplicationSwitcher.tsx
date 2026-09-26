import { APPLICATIONS } from '@/lib/applications';
import { Icon } from './icons';
import { cn } from './ui';

// Switch the protected application. The decentralization layer below is
// identical for each — only the parties, threshold and action change.
export function ApplicationSwitcher({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
      {APPLICATIONS.map((a) => {
        const active = a.id === selected;
        return (
          <button
            key={a.id}
            onClick={() => onSelect(a.id)}
            className={cn(
              'flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all',
              active
                ? 'border-brand-500/60 bg-brand-500/[0.08] ring-1 ring-brand-500/40'
                : 'border-white/8 bg-white/[0.02] hover:border-white/20',
            )}
          >
            <span
              className={cn(
                'grid h-9 w-9 flex-none place-items-center rounded-lg',
                active ? 'bg-brand-500 text-white' : 'bg-white/5 text-brand-400',
              )}
            >
              <Icon name={a.icon} size={16} />
            </span>
            <span className="min-w-0">
              <b className="block truncate text-[13px] text-slate-100">{a.name}</b>
              <small className="block font-mono text-[11px] text-slate-500">
                {a.threshold}/{a.parties.length} approvals
              </small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
