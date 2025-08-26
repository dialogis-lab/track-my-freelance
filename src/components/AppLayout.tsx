import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { usePlan } from '@/hooks/usePlan';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Clock, Users, FolderOpen, BarChart3, Receipt, Settings, LogOut, Timer, ShieldCheck, User, Crown } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { signOut, user } = useAuth();
  const { isAdmin } = useUserRole();
  const { isFree } = usePlan();
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Clock },
    { name: 'Projects', href: '/projects', icon: FolderOpen },
    { name: 'Clients', href: '/clients', icon: Users },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Invoices', href: '/invoices', icon: Receipt },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="w-full">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="ml-2">
            <BrandLogo size="md" showWordmark />
          </div>

          <div className="no-scrollbar -mx-2 overflow-x-auto">
            <nav className="hidden md:flex gap-1 px-2 snap-x">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                const baseClasses = "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors snap-start";
                const idleClasses = "text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
                const activeClasses = "text-foreground relative after:content-[''] after:absolute after:left-3 after:right-3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-blue-500 after:via-teal-500 after:to-green-500";
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`${baseClasses} ${isActive ? activeClasses : idleClasses}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="shrink-0 h-4 w-4" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 justify-end min-w-[200px]">
            {isAdmin && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin">
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Admin
                </Link>
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:block text-sm">{user?.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {isFree && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="flex items-center">
                        <Crown className="w-4 h-4 mr-2 text-primary" />
                        Upgrade Plan
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="md:hidden border-b border-border bg-card">
        <div className="no-scrollbar -mx-2 overflow-x-auto">
          <div className="flex gap-1 px-2 py-2 snap-x">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              const baseClasses = "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors snap-start min-h-[44px]";
              const idleClasses = "text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
              const activeClasses = "text-foreground relative after:content-[''] after:absolute after:left-3 after:right-3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-blue-500 after:via-teal-500 after:to-green-500";
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`${baseClasses} ${isActive ? activeClasses : idleClasses}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="shrink-0 h-4 w-4" />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
            
            {/* Mobile admin shortcut */}
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="inline-flex items-center gap-2 px-3 py-2 whitespace-nowrap snap-start min-h-[44px]"
              >
                <Link to="/admin">
                  <ShieldCheck className="shrink-0 h-4 w-4" />
                  <span className="truncate">Admin</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          {(import.meta.env.DEV || import.meta.env.VITE_ENABLE_SYSTEM_CHECK === 'true') && user && (
            <Link 
              to="/system-check" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Dev
            </Link>
          )}
          <div className="flex-1 flex justify-center">
            <p className="text-sm text-muted-foreground">
              &copy; 2024 TimeHatch. All rights reserved.
            </p>
          </div>
          {/* Spacer for layout balance */}
          <div className="w-8"></div>
        </div>
      </footer>
    </div>
  );
}