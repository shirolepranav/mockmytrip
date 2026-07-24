/*
 * Procedural passport stamp (DS §6): circular/oval, single ink color,
 * slightly rotated and imperfect. Built for the Phase 5 booking-reveal
 * set-piece; explicitly reusable as-is on Phase 6's passport page.
 */

export interface PassportStampProps {
  stampStyle: number;
  rotationDeg: number;
  inkHue: number;
  city: string;
  countryIso: string;
  dateLabel: string;
  size?: number;
  className?: string;
}

export function PassportStamp({
  stampStyle,
  rotationDeg,
  inkHue,
  city,
  countryIso,
  dateLabel,
  size = 120,
  className,
}: PassportStampProps) {
  const ink = `hsl(${inkHue} 68% 34%)`;
  const variant = ((stampStyle % 3) + 3) % 3;
  const c = size / 2;
  const rx = variant === 1 ? size * 0.42 : size * 0.46;
  const ry = variant === 1 ? size * 0.34 : size * 0.46;

  return (
    <svg
      role="img"
      aria-label={`Passport stamp: ${city}, ${countryIso}`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={{ transform: `rotate(${rotationDeg}deg)` }}
    >
      <ellipse
        cx={c}
        cy={c}
        rx={rx}
        ry={ry}
        fill="none"
        stroke={ink}
        strokeWidth={size * 0.035}
      />
      <ellipse
        cx={c}
        cy={c}
        rx={rx - size * 0.07}
        ry={ry - size * 0.07}
        fill="none"
        stroke={ink}
        strokeWidth={size * 0.014}
        strokeDasharray={variant === 2 ? `${size * 0.02} ${size * 0.02}` : undefined}
      />
      <text
        x={c}
        y={c - size * 0.14}
        textAnchor="middle"
        fill={ink}
        fontSize={size * 0.11}
        fontWeight={700}
        letterSpacing={1}
        fontFamily="var(--font-mono)"
      >
        {countryIso}
      </text>
      <text
        x={c}
        y={c + size * 0.04}
        textAnchor="middle"
        fill={ink}
        fontSize={size * 0.13}
        fontWeight={700}
        fontFamily="var(--font-display)"
      >
        {city.toUpperCase()}
      </text>
      <text
        x={c}
        y={c + size * 0.22}
        textAnchor="middle"
        fill={ink}
        fontSize={size * 0.08}
        fontFamily="var(--font-mono)"
      >
        {dateLabel}
      </text>
    </svg>
  );
}
