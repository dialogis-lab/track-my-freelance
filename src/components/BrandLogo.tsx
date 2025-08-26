import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BRAND } from '@/config/brand';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  noLink?: boolean;
  showWordmark?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-auto md:h-10',
  md: 'h-12 w-auto md:h-16',
  lg: 'h-20 w-auto md:h-24',
  xl: 'h-24 w-auto md:h-32 lg:h-40'
};

const wordmarkSizes = {
  sm: 'text-sm font-semibold',
  md: 'text-lg font-semibold',
  lg: 'text-xl font-bold',
  xl: 'text-2xl font-bold'
};

export function BrandLogo({ size = 'md', className, noLink = false, showWordmark = false }: BrandLogoProps) {
  const logoImage = (
    <img
      src={BRAND.logoSrc}
      alt={BRAND.alt}
      width={512}
      height={512}
      className={cn(
        sizeClasses[size],
        'shrink-0 transition-opacity hover:opacity-90 object-contain',
        className
      )}
      loading={size === 'xl' || size === 'md' ? 'eager' : 'lazy'}
    />
  );

  // Only show adjacent wordmark text if the logo does NOT contain a wordmark AND showWordmark is requested
  const logoWithWordmark = (showWordmark && !BRAND.logoHasWordmark) ? (
    <div className="flex items-center space-x-3">
      {logoImage}
      <span className={cn(
        wordmarkSizes[size],
        'text-foreground dark:text-foreground'
      )}>
        {BRAND.name}
      </span>
    </div>
  ) : logoImage;

  if (noLink) {
    return logoWithWordmark;
  }

  return (
    <Link to="/" className="inline-block transition-opacity hover:opacity-90">
      {logoWithWordmark}
    </Link>
  );
}