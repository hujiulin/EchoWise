export default function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-label="EchoWise"
    >
      <circle cx="11" cy="16" r="3.2" fill="currentColor" />
      <path
        d="M17 8.5 C24.5 11.5, 24.5 20.5, 17 23.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
    </svg>
  );
}
