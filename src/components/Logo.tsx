export function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-[10px] text-white ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #5b7cff 0%, #4d6bfe 55%, #3d55d8 100%)',
      }}
      aria-hidden
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 15.5c3.2 0 5.2-1.5 7-4.2 1.6-2.4 3.4-3.8 6-3.8"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M4 20c3.4 0 5.6-1.7 7.4-4.4"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="17.6" cy="7.4" r="1.9" fill="rgba(255,255,255,0.95)" />
      </svg>
    </div>
  );
}
