import React, { createContext, useContext, useState, useEffect } from 'react';

interface AdminRevealContextType {
  isRevealed: boolean;
  reveal: () => void;
}

const AdminRevealContext = createContext<AdminRevealContextType | undefined>(undefined);

export function AdminRevealProvider({ children }: { children: React.ReactNode }) {
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    // Check session storage on mount
    const revealed = sessionStorage.getItem('th_adminReveal') === '1';
    setIsRevealed(revealed);

    // Add keyboard shortcut listener
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        reveal();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, []);

  const reveal = () => {
    setIsRevealed(true);
    sessionStorage.setItem('th_adminReveal', '1');
  };

  return (
    <AdminRevealContext.Provider value={{ isRevealed, reveal }}>
      {children}
    </AdminRevealContext.Provider>
  );
}

export function useAdminReveal() {
  const context = useContext(AdminRevealContext);
  if (context === undefined) {
    throw new Error('useAdminReveal must be used within an AdminRevealProvider');
  }
  return context;
}