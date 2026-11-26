import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';

function resizeImageToDataUrl(file, maxSize = 320) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AvatarUpload({ value, name = 'Member', onChange }) {
  const inputRef = useRef(null);
  const [processing, setProcessing] = useState(false);

  const initials = (name || 'M')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    try {
      const compressed = await resizeImageToDataUrl(file);
      onChange(compressed);
    } finally {
      setProcessing(false);
      e.target.value = '';
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative h-22 w-22 shrink-0 rounded-[24px] border-2 border-white/15 shadow-lg bg-gradient-to-br from-[#FF9A5A] to-[#E56717] overflow-hidden flex items-center justify-center">
        {value ? (
          <img src={value} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xl font-extrabold text-white">{initials}</span>
        )}
      </div>

      <div className="space-y-2 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            disabled={processing}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full btn-papaya px-4 py-2 text-xs font-semibold text-white hover:brightness-110 transition-colors shadow-sm"
          >
            <Camera className="h-3.5 w-3.5 text-white" />
            {processing ? 'Processing...' : value ? 'Change Photo' : 'Upload Photo'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/8 px-3.5 py-2 text-xs font-semibold text-white/60 hover:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
