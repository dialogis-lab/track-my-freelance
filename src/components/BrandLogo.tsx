import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  noLink?: boolean;
}

const sizeClasses = {
  sm: 'h-6 w-auto md:h-7',
  md: 'h-8 w-auto md:h-10',
  lg: 'h-12 w-auto md:h-16',
  xl: 'h-16 w-auto md:h-24 lg:h-28'
};

export function BrandLogo({ size = 'md', className, noLink = false }: BrandLogoProps) {
  const logoImage = (
    <img
      src="/lovable-uploads/616ce768-d85d-47c9-a922-8f85c874b052.png"
      alt="TimeHatch logo"
      width={512}
      height={512}
      className={cn(
        sizeClasses[size],
        'shrink-0 transition-opacity hover:opacity-90',
        className
      )}
      loading={size === 'xl' || size === 'md' ? 'eager' : 'lazy'}
    />
  );

  if (noLink) {
    return logoImage;
  }

  return (
    <Link to="/" className="inline-block">
      {logoImage}
    </Link>
  );
}