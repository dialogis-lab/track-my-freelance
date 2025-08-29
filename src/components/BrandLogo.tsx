import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BRAND } from '@/config/brand';
import { useAdminReveal } from './AdminRevealProvider';
import { useRef, useCallback } from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  noLink?: boolean;
  showWordmark?: boolean;
}

const sizeClasses = {
  sm: 'h-16 w-auto md:h-20',
  md: 'h-24 w-auto md:h-32',
  lg: 'h-40 w-auto md:h-48',
  xl: 'h-48 w-auto md:h-64 lg:h-80'
};

const wordmarkSizes = {
  sm: 'text-sm font-semibold',
  md: 'text-lg font-semibold',
  lg: 'text-xl font-bold',
  xl: 'text-2xl font-bold'
};

export function BrandLogo({ size = 'md', className, noLink = false, showWordmark = false }: BrandLogoProps) {
  const { reveal } = useAdminReveal();
  const clickCountRef = useRef(0);
  const firstClickTimeRef = useRef<number | null>(null);
  const lastClickTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTripleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    
    const now = Date.now();
    
    // Reset if too much time has passed since first click (>1200ms)
    if (firstClickTimeRef.current && now - firstClickTimeRef.current > 1200) {
      clickCountRef.current = 0;
      firstClickTimeRef.current = null;
    }
    
    // Reset if too much time has passed since last click (>400ms)
    if (lastClickTimeRef.current && now - lastClickTimeRef.current > 400) {
      clickCountRef.current = 0;
      firstClickTimeRef.current = null;
    }
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Increment click count
    clickCountRef.current++;
    
    // Set first click time if this is the first click
    if (clickCountRef.current === 1) {
      firstClickTimeRef.current = now;
    }
    
    lastClickTimeRef.current = now;
    
    // Check for triple click
    if (clickCountRef.current === 3) {
      const totalTime = now - (firstClickTimeRef.current || now);
      if (totalTime <= 1200) {
        reveal();
        console.debug('[logo] Triple-click detected, admin revealed');
      }
      // Reset after successful triple click
      clickCountRef.current = 0;
      firstClickTimeRef.current = null;
      lastClickTimeRef.current = null;
    } else {
      // Set timeout to reset after 1200ms
      timeoutRef.current = setTimeout(() => {
        clickCountRef.current = 0;
        firstClickTimeRef.current = null;
        lastClickTimeRef.current = null;
      }, 1200);
    }
  }, [reveal]);

  const logoImage = (
    <img
      src={BRAND.logoSrc}
      alt={BRAND.alt}
      width={512}
      height={512}
      className={cn(
        sizeClasses[size],
        'block shrink-0 transition-opacity hover:opacity-90 object-contain cursor-pointer',
        className
      )}
      loading={size === 'xl' || size === 'md' ? 'eager' : 'lazy'}
      onClick={handleTripleClick}
    />
  );

  // Only show adjacent wordmark text if the logo does NOT contain a wordmark AND showWordmark is requested
  const logoWithWordmark = (showWordmark && !BRAND.logoHasWordmark) ? (
    <div className="flex items-center space-x-3">
      {logoImage}
      <span 
        className={cn(
          wordmarkSizes[size],
          'text-foreground dark:text-foreground cursor-pointer'
        )}
        onClick={handleTripleClick}
      >
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