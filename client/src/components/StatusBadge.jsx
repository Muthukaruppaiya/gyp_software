const STYLES = {
  active: 'glass-chip text-white border-white/20',
  paid: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  in_gym: 'bg-[#E56717] text-white border-[#E56717] shadow-sm shadow-[#E56717]/30',
  completed: 'bg-white/8 text-white/80 border-white/10',
  pending: 'bg-[#E56717]/20 text-[#FF8F4A] border-[#E56717]/30',
  partial: 'bg-[#E56717]/15 text-[#FF8F4A] border-[#E56717]/30',
  frozen: 'bg-white/10 text-white/80 border-white/15',
  overdue: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  expired: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

const LABELS = {
  in_gym: 'In Progress',
};

export default function StatusBadge({ status, label }) {
  const key = String(status || '').toLowerCase();
  const cls = STYLES[key] || 'bg-white/8 text-white/80 border-white/10';
  const text = label || LABELS[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : '—');
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${cls}`}>
      {key === 'in_gym' && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
      {text}
    </span>
  );
}
