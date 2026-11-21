import { useState } from 'react';
import {
  Camera,
  Monitor,
  Calculator,
  Dumbbell,
  Sparkles,
  Tent,
  Mic,
  Volume2,
  Backpack,
  Lightbulb,
  Package,
} from 'lucide-react';

interface ProductImageProps {
  src: string;
  alt: string;
  categoryName?: string;
  aspectClass?: string;
  className?: string;
  fit?: 'cover' | 'contain';
}

function getPlaceholderMeta(src: string, alt: string, categoryName?: string) {
  const hint = `${src} ${alt} ${categoryName || ''}`.toLowerCase();
  if (hint.includes('tripod')) {
    return { Icon: Camera, label: 'Tripod Studio Equipment', code: src };
  }
  if (hint.includes('lighting')) {
    return { Icon: Lightbulb, label: 'LED Softbox Lighting Kit', code: src };
  }
  if (hint.includes('camera') || hint.includes('action')) {
    return { Icon: Camera, label: 'Photography Gear', code: src };
  }
  if (hint.includes('projector')) {
    return { Icon: Monitor, label: 'Presentation Projector', code: src };
  }
  if (hint.includes('mic')) {
    return { Icon: Mic, label: 'Studio Microphone', code: src };
  }
  if (hint.includes('calculator') || hint.includes('education')) {
    return { Icon: Calculator, label: 'Academic Calculator', code: src };
  }
  if (hint.includes('speaker')) {
    return { Icon: Volume2, label: 'Portable PA Audio', code: src };
  }
  if (hint.includes('costume') || hint.includes('event')) {
    return { Icon: Sparkles, label: 'Event & Stage Gear', code: src };
  }
  if (hint.includes('backpack')) {
    return { Icon: Backpack, label: 'Travel Rucksack', code: src };
  }
  if (hint.includes('camp') || hint.includes('travel') || hint.includes('outdoor')) {
    return { Icon: Tent, label: 'Outdoor & Camping', code: src };
  }
  if (hint.includes('fitness') || hint.includes('badminton') || hint.includes('sport')) {
    return { Icon: Dumbbell, label: 'Sports & Fitness', code: src };
  }
  return { Icon: Package, label: categoryName || 'Rental Item', code: src };
}

export function ProductImage({
  src,
  alt,
  categoryName,
  aspectClass = 'aspect-[4/3]',
  className = '',
  fit = 'cover',
}: ProductImageProps) {
  const isRenderablePhoto =
    src.startsWith('/src/assets/images/') ||
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('data:image/');
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imgFailed = !isRenderablePhoto || failedSrc === src;

  if (!imgFailed && src) {
    return (
      <div
        className={`relative w-full overflow-hidden bg-[#F6F7FB] ${aspectClass} ${className}`}
        data-image-path={src.startsWith('data:image/') ? 'uploaded-image' : src}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
          className={`h-full w-full transition-transform duration-300 ease-out group-hover:scale-[1.03] ${
            fit === 'contain' ? 'object-contain p-2 bg-white' : 'object-cover'
          }`}
        />
      </div>
    );
  }

  const { Icon, label, code } = getPlaceholderMeta(src, alt, categoryName);

  return (
    <div
      className={`relative flex w-full flex-col items-center justify-center overflow-hidden bg-[#F6F7FB] px-6 text-center ${aspectClass} ${className}`}
      data-image-path={src}
      role="img"
      aria-label={alt}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, #E9EDFF 0%, transparent 55%), radial-gradient(circle at 85% 80%, #EEF1FA 0%, transparent 50%)',
        }}
      />
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-[#E5E8F0] bg-white text-[#5478D5] shadow-xs">
          <Icon className="h-6 w-6 stroke-[1.75]" />
        </div>
        <span className="text-xs font-medium text-[#252A34]">{label}</span>
        <span className="mt-1 font-mono text-[11px] text-[#646B7A] truncate max-w-[190px]">
          {code}
        </span>
      </div>
    </div>
  );
}
