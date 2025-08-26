import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  noLink?: boolean;
  showWordmark?: boolean;
}

const sizeClasses = {
  sm: 'h-6 w-auto md:h-7',
  md: 'h-8 w-auto md:h-10',
  lg: 'h-12 w-auto md:h-16',
  xl: 'h-20 w-auto md:h-24 lg:h-28' // Ensure mobile doesn't go below h-20
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
      src="/lovable-uploads/60738053-891e-492a-8cbc-2ed116a458a9.png"
      alt="TimeHatch logo"
      width={512}
      height={512}
      className={cn(
        sizeClasses[size],
        'shrink-0 transition-opacity hover:opacity-90',
        // Add subtle background for dark mode contrast
        'dark:bg-background/5 dark:rounded-lg dark:p-1',
        className
      )}
      loading={size === 'xl' || size === 'md' ? 'eager' : 'lazy'}
    />
  );

  const logoWithWordmark = showWordmark ? (
    <div className="flex items-center space-x-3">
      {logoImage}
      <span className={cn(
        wordmarkSizes[size],
        'text-foreground dark:text-foreground'
      )}>
        TimeHatch
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