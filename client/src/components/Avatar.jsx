import { useState } from 'react';

const SIZES = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
};

export function initialsOf(name = '') {
  return (
    String(name)
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || '?'
  );
}

/** Member photo with an initials fallback (also used when the image fails to load). */
export default function Avatar({ src, name, size = 'sm', ring = false, className = '' }) {
  const [failed, setFailed] = useState(false);
  const sizeCls = SIZES[size] || SIZES.sm;
  const ringCls = ring ? 'ring-2 ring-[#E56717] ring-offset-2 ring-offset-[#0c0c0e]' : 'border border-white/15';

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name || 'Member'}
        onError={() => setFailed(true)}
        className={`${sizeCls} ${ringCls} shrink-0 rounded-full object-cover bg-white/10 ${className}`}
      />
    );
  }
  return (
    <div
      className={`${sizeCls} ${ringCls} shrink-0 rounded-full bg-gradient-to-br from-[#FF9A5A] to-[#C8560F] flex items-center justify-center font-extrabold text-white ${className}`}
      aria-label={name}
    >
      {initialsOf(name)}
    </div>
  );
}
