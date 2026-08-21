import styled, { keyframes } from 'styled-components';

const rotate = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

const dash = keyframes`
  0% {
    stroke-dashoffset: calc(var(--circumference) * 0.95);
  }
  50% {
    stroke-dashoffset: calc(var(--circumference) * 0.25);
  }
  100% {
    stroke-dashoffset: calc(var(--circumference) * 0.95);
  }
`;

const Svg = styled.svg`
  animation: ${rotate} 1.1s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Track = styled.circle`
  opacity: 0.25;
`;

const Indicator = styled.circle`
  animation: ${dash} 1.3s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    stroke-dashoffset: calc(var(--circumference) * 0.6);
  }
`;

export interface ProgressRingProps {
  size?: number;
  strokeWidth?: number;
  /** Defaults to `currentColor` so it inherits the button/text color it's placed in. */
  color?: string;
  'aria-hidden'?: boolean;
}

/**
 * ProgressRing — small circular submit/loading indicator used inside
 * buttons and inline action rows for API-submit interactions, per
 * user request for "progress rings on click API submit interactions".
 * Purely decorative by default (`aria-hidden`); pair with visually
 * hidden text or an `aria-live` region for the accessible status.
 */
export function ProgressRing({ size = 18, strokeWidth = 2.5, color = 'currentColor', ...rest }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden={rest['aria-hidden'] ?? true}
      focusable="false"
      style={{ ['--circumference' as string]: circumference }}
    >
      <Track cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} />
      <Indicator
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
      />
    </Svg>
  );
}
