// Minimal inline stroke icons (offline: no icon font or CDN).
import type { ComponentType, SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }
const base = (size = 18): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
})

export const ArrowUpRight = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M7 17 17 7M8 7h9v9" /></svg>
export const Gear = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
export const Bell = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
export const User = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
export const Heart = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8Z" /></svg>
export const Dumbbell = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M6 6v12M18 6v12M3 9v6M21 9v6M6 12h12" /></svg>
export const Shield = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg>
export const Brain = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5s1.2 1.5 3.5 1.5 3.5-1.5 3.5-1.5M9 9.5h.01M15 9.5h.01" /></svg>
export const Atom = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="1.5" /><ellipse cx="12" cy="12" rx="10" ry="4" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" /></svg>
export const Eye = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
export const Check = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="m5 12 5 5L20 7" /></svg>
export const ChevronDown = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="m6 9 6 6 6-6" /></svg>
export const Plus = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>
export const Doc = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></svg>
export const Sparkle = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" /></svg>

export const Apple = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 7c-1-2-3-3-5-2.5S3.5 8 4 11.5 7 20 9.5 20c1.2 0 1.6-.6 2.5-.6s1.3.6 2.5.6C17 20 19.5 15 20 11.5S18 4 15.5 4.5 13 6 12 7Z" /><path d="M12 7c0-2 1-3.5 3-4" /></svg>
export const Camera = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.5" r="3.5" /></svg>
export const Info = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></svg>
export const Trophy = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6" /></svg>
export const Flame = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 2-5 5-5 8 0 4 3 7 7 7Z" /></svg>
export const Book = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5ZM4 19a2 2 0 0 1 2-2h13" /></svg>
export const Lungs = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 4v8M12 12c-1 1-2 1-3 1M12 12c1 1 2 1 3 1M9 7C6 7 4 11 4 16c0 2 1 3 3 3s2-2 2-4V7ZM15 7c3 0 5 4 5 9 0 2-1 3-3 3s-2-2-2-4V7Z" /></svg>

export const DOMAIN_ICON: Record<string, ComponentType<P>> = {
  cardio: Heart, bone: Dumbbell, immune: Shield, behavior: Brain, radiation: Atom, env: Eye, nutrition: Apple,
}
