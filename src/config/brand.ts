export const BRAND = {
  // Logo paths - using the uploaded logo with integrated wordmark
  logoSrc: "/lovable-uploads/60738053-891e-492a-8cbc-2ed116a458a9.png",
  iconSrc: "/lovable-uploads/60738053-891e-492a-8cbc-2ed116a458a9.png", // Same as logo for now
  logoHasWordmark: true, // The uploaded logo includes "TimeHatch" text
  
  // Responsive heights in pixels
  heights: {
    header: { mobile: 32, desktop: 36 },
    footer: { mobile: 24, desktop: 28 },
    hero: { mobile: 48, desktop: 56 },
  },
  
  // Hero logo specific sizes (px)
  heroLogo: {
    mobile: 64,   // px
    md: 72,       // px  
    lg: 80,       // px
  },
  
  alt: "TimeHatch - Effortless Time Tracking & Smart Invoicing",
  
  // Brand text (only used when logoHasWordmark is false)
  name: "TimeHatch",
};