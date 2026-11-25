import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import ProgressRing from './ProgressRing';

export default function StatCard({ title, value, subtitle, icon: Icon, accent = 'orange', ringPercent, to }) {
  const accents = {
    orange: 'bg-[#E56717]/15 text-[#FF8F4A] border-[#E56717]/25',
    black: 'glass-chip text-white border-white/20',
    peach: 'bg-[#E56717]/15 text-[#FF8F4A] border-[#E56717]/40',
    emerald: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25',
    rose: 'bg-rose-500/12 text-rose-300 border-rose-500/25',
  };

  const body = (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {Icon && (
            <span
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                accents[accent] || accents.orange
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
          )}
          <p className="text-xs font-semibold text-white/60 truncate">{title}</p>
        </div>
        <p className="mt-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-white truncate">{value}</p>
        {subtitle && <p className="mt-1 text-xs text-white/55 truncate">{subtitle}</p>}
      </div>
      {ringPercent !== undefined && <ProgressRing percent={ringPercent} size={54} strokeWidth={5} />}
      {to && <ChevronRight className="h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-[#FF8F4A]" />}
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="group glass-card block p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#E56717]/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E56717]"
      >
        {body}
      </Link>
    );
  }

  return <div className="glass-card p-4 sm:p-5 transition-transform duration-200 hover:-translate-y-0.5">{body}</div>;
}
