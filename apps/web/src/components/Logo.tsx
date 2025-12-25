import Image from 'next/image';

type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface LogoProps {
  size?: LogoSize;
  showText?: boolean;
  className?: string;
}

const sizes: Record<LogoSize, number> = {
  xs: 24,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

export function Logo({ size = 'md', showText = false, className = '' }: LogoProps) {
  const dimension = sizes[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/logo/logo.png"
        alt="Orchestr'A"
        width={dimension}
        height={dimension}
        className="object-contain"
        priority={size === 'lg' || size === 'xl'}
      />
      {showText && (
        <span
          className={`font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent ${
            size === 'xs' ? 'text-sm' :
            size === 'sm' ? 'text-base' :
            size === 'md' ? 'text-lg' :
            size === 'lg' ? 'text-xl' :
            'text-2xl'
          }`}
        >
          ORCHESTR&apos;A
        </span>
      )}
    </div>
  );
}

export function LogoIcon({ size = 'sm', className = '' }: Omit<LogoProps, 'showText'>) {
  const dimension = sizes[size];

  return (
    <Image
      src="/logo/logo.png"
      alt="Orchestr'A"
      width={dimension}
      height={dimension}
      className={`object-contain ${className}`}
    />
  );
}
