interface SvgProps {
  className?: string;
}

export type HeroSvgType =
  | 'cameras'
  | 'tripods'
  | 'projectors'
  | 'calculators'
  | 'microphones'
  | 'lights'
  | 'sports'
  | 'camping';

/**
 * Cute crisp vector line-art SVGs with soft BorrowBox pastel accents (#E9EDFF / #5478D5)
 * for the 8 hero showcase boxes and Explore Rentals category tabs.
 */
export function HeroObjectSvg({ type, className = 'h-12 w-12' }: { type: HeroSvgType; className?: string }) {
  switch (type) {
    case 'cameras':
      return <CameraCuteSvg className={className} />;
    case 'tripods':
      return <TripodCuteSvg className={className} />;
    case 'projectors':
      return <ProjectorCuteSvg className={className} />;
    case 'calculators':
      return <CalculatorCuteSvg className={className} />;
    case 'microphones':
      return <MicrophoneCuteSvg className={className} />;
    case 'lights':
      return <StudioLightCuteSvg className={className} />;
    case 'sports':
      return <SportsCuteSvg className={className} />;
    case 'camping':
      return <CampingCuteSvg className={className} />;
  }
}

export function CategoryTabSvg({ categoryKey, className = 'h-8 w-8' }: { categoryKey: string; className?: string }) {
  const key = categoryKey.toLowerCase();
  if (key === 'all') return <AllRentalsCuteSvg className={className} />;
  if (key === 'bundles' || key.includes('bundle')) return <BundlesCuteSvg className={className} />;
  if (key.includes('photo') || key.includes('camera')) return <CameraCuteSvg className={className} />;
  if (key.includes('electro') || key.includes('proj')) return <ProjectorCuteSvg className={className} />;
  if (key.includes('edu') || key.includes('calc')) return <CalculatorCuteSvg className={className} />;
  if (key.includes('sport') || key.includes('fit')) return <SportsCuteSvg className={className} />;
  if (key.includes('event') || key.includes('costume') || key.includes('stage')) return <EventsCuteSvg className={className} />;
  if (key.includes('travel') || key.includes('camp') || key.includes('outdoor')) return <CampingCuteSvg className={className} />;
  return <GenericGearCuteSvg className={className} />;
}

export function AllRentalsCuteSvg({ className = 'h-8 w-8' }: SvgProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <rect x="7" y="7" width="14" height="14" rx="3.5" fill="#E9EDFF" stroke="#252A34" strokeWidth="2.2" />
      <rect x="27" y="7" width="14" height="14" rx="3.5" fill="#FFFFFF" stroke="#252A34" strokeWidth="2.2" />
      <rect x="7" y="27" width="14" height="14" rx="3.5" fill="#FFFFFF" stroke="#252A34" strokeWidth="2.2" />
      <rect x="27" y="27" width="14" height="14" rx="3.5" fill="#5478D5" fillOpacity="0.22" stroke="#5478D5" strokeWidth="2.2" />
      <circle cx="14" cy="14" r="2.2" fill="#5478D5" />
      <path d="M31 34l2.2 2.2 4-4.4" stroke="#5478D5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BundlesCuteSvg({ className = 'h-8 w-8' }: SvgProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <rect x="8" y="18" width="32" height="22" rx="4" fill="#E9EDFF" stroke="#252A34" strokeWidth="2.2" />
      <path d="M6 14.5C6 12.6 7.6 11 9.5 11h29c1.9 0 3.5 1.6 3.5 3.5V18H6v-3.5z" fill="#FFFFFF" stroke="#252A34" strokeWidth="2.2" />
      <path d="M24 11v29" stroke="#5478D5" strokeWidth="2.4" />
      <path d="M24 11c-2.5-4-7-4-7-1.2 0 2 3.5 2.7 7 1.2zm0 0c2.5-4 7-4 7-1.2 0 2-3.5 2.7-7 1.2z" fill="#E9EDFF" stroke="#5478D5" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="33" cy="29" r="3" fill="#5478D5" fillOpacity="0.25" stroke="#5478D5" strokeWidth="1.8" />
    </svg>
  );
}

export function CameraCuteSvg({ className = 'h-12 w-12' }: SvgProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path d="M16 12l2.4-3.2c.6-.8 1.5-1.3 2.5-1.3h6.2c1 0 1.9.5 2.5 1.3L32 12" fill="#E9EDFF" stroke="#252A34" strokeWidth="2.2" strokeLinejoin="round" />
      <rect x="6" y="12" width="36" height="26" rx="5" fill="#FFFFFF" stroke="#252A34" strokeWidth="2.2" />
      <rect x="9" y="15" width="30" height="20" rx="3" fill="#F6F7FB" />
      <circle cx="24" cy="25" r="8.5" fill="#E9EDFF" stroke="#252A34" strokeWidth="2.2" />
      <circle cx="24" cy="25" r="4.2" fill="#5478D5" fillOpacity="0.25" stroke="#5478D5" strokeWidth="2" />
      <circle cx="22.3" cy="23.2" r="1.3" fill="#FFFFFF" />
      <circle cx="35.5" cy="17.5" r="1.8" fill="#5478D5" />
      <path d="M11 10h4" stroke="#5478D5" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function TripodCuteSvg({ className = 'h-12 w-12' }: SvgProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <rect x="17" y="7" width="14" height="7" rx="2.5" fill="#E9EDFF" stroke="#252A34" strokeWidth="2.2" />
      <path d="M14 10.5h3M31 10.5h5" stroke="#5478D5" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="20" y="14" width="8" height="6" rx="1.5" fill="#FFFFFF" stroke="#252A34" strokeWidth="2.2" />
      <path d="M21 20L11 41M24 20v18M27 20l10 21" stroke="#252A34" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M16 30h16" stroke="#5478D5" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="30" r="2.2" fill="#E9EDFF" stroke="#5478D5" strokeWidth="1.8" />
    </svg>
  );
}

export function ProjectorCuteSvg({ className = 'h-12 w-12' }: SvgProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <rect x="6" y="17" width="31" height="16" rx="4" fill="#FFFFFF" stroke="#252A34" strokeWidth="2.2" />
      <path d="M11 33v4M32 33v4" stroke="#252A34" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="27" cy="25" r="5.5" fill="#E9EDFF" stroke="#252A34" strokeWidth="2.2" />
      <circle cx="27" cy="25" r="2.2" fill="#5478D5" />
      <path d="M11 22h7M11 26h5" stroke="#5478D5" strokeWidth="2" strokeLinecap="round" />
      <path d="M37 22l6-4v14l-6-4" fill="#E9EDFF" stroke="#5478D5" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function CalculatorCuteSvg({ className = 'h-12 w-12' }: SvgProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <rect x="11" y="6" width="26" height="36" rx="4.5" fill="#FFFFFF" stroke="#252A34" strokeWidth="2.2" />
      <rect x="15" y="10.5" width="18" height="8" rx="2" fill="#E9EDFF" stroke="#5478D5" strokeWidth="1.8" />
      <circle cx="17" cy="24" r="1.8" fill="#252A34" />
      <circle cx="24" cy="24" r="1.8" fill="#252A34" />
      <circle cx="31" cy="24" r="1.8" fill="#5478D5" />
      <circle cx="17" cy="30" r="1.8" fill="#252A34" />
      <circle cx="24" cy="30" r="1.8" fill="#252A34" />
      <circle cx="17" cy="36" r="1.8" fill="#252A34" />
      <circle cx="24" cy="36" r="1.8" fill="#252A34" />
      <rect x="29" y="28.5" width="4" height="9.2" rx="1.8" fill="#5478D5" />
    </svg>
  );
}

export function MicrophoneCuteSvg({ className = 'h-12 w-12' }: SvgProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <rect x="18" y="7" width="12" height="19" rx="6" fill="#E9EDFF" stroke="#252A34" strokeWidth="2.2" />
      <path d="M21 13h6M21 17h6" stroke="#5478D5" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13 21a11 11 0 0022 0" stroke="#252A34" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M24 32v9M17 41h14" stroke="#252A34" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="24" cy="36" r="2" fill="#5478D5" />
    </svg>
  );
}

export function StudioLightCuteSvg({ className = 'h-12 w-12' }: SvgProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path d="M13 10h22l4 13H9l4-13z" fill="#E9EDFF" stroke="#252A34" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M18 16h12" stroke="#5478D5" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M24 23v18M17 41l7-6 7 6" stroke="#252A34" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 27l-2 3M24 27v3M33 27l2 3" stroke="#5478D5" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function SportsCuteSvg({ className = 'h-12 w-12' }: SvgProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <ellipse cx="29" cy="18" rx="9" ry="11" transform="rotate(35 29 18)" fill="#E9EDFF" stroke="#252A34" strokeWidth="2.2" />
      <path d="M24 14l9 8M26 11l9 8M22 18l8 7" stroke="#5478D5" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M22 26l-10 12" stroke="#252A34" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M9 39l3-3" stroke="#5478D5" strokeWidth="3.6" strokeLinecap="round" />
      <circle cx="13" cy="14" r="3.2" fill="#FFFFFF" stroke="#5478D5" strokeWidth="2" />
    </svg>
  );
}

export function CampingCuteSvg({ className = 'h-12 w-12' }: SvgProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path d="M7 37L24 11l17 26H7z" fill="#E9EDFF" stroke="#252A34" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M24 11l-3.5-4.5M24 11l3.5-4.5" stroke="#5478D5" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 37l5-12 5 12" fill="#FFFFFF" stroke="#252A34" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M5 37h38" stroke="#252A34" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="37" cy="13" r="3" fill="#5478D5" fillOpacity="0.25" stroke="#5478D5" strokeWidth="1.8" />
    </svg>
  );
}

export function EventsCuteSvg({ className = 'h-8 w-8' }: SvgProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path d="M9 12c0-1.7 1.3-3 3-3h24c1.7 0 3 1.3 3 3v12c0 8.3-6.7 15-15 15S9 32.3 9 24V12z" fill="#E9EDFF" stroke="#252A34" strokeWidth="2.2" />
      <path d="M16 19c1.2-1.2 2.8-1.2 4 0M28 19c1.2-1.2 2.8-1.2 4 0" stroke="#252A34" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M18 27c2 2.5 10 2.5 12 0" stroke="#5478D5" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="38" cy="10" r="2.2" fill="#5478D5" />
    </svg>
  );
}

export function GenericGearCuteSvg({ className = 'h-8 w-8' }: SvgProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <rect x="8" y="13" width="32" height="24" rx="4" fill="#E9EDFF" stroke="#252A34" strokeWidth="2.2" />
      <path d="M17 13v-2.5c0-1.4 1.1-2.5 2.5-2.5h9c1.4 0 2.5 1.1 2.5 2.5V13" stroke="#252A34" strokeWidth="2.2" />
      <path d="M8 23h32" stroke="#5478D5" strokeWidth="2" />
      <rect x="21" y="20" width="6" height="6" rx="1.5" fill="#FFFFFF" stroke="#5478D5" strokeWidth="2" />
    </svg>
  );
}
