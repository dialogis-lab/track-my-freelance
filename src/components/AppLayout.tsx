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
      <header className="border-b border-border bg-card min-h-[3.5rem]">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="ml-2">
            <BrandLogo size="md" showWordmark />
          </div>

          <nav className="hidden md:flex items-center space-x-6">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center space-x-4">
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
      </header>

      {/* Mobile Navigation */}
      <nav className="md:hidden border-b border-border bg-card">
        <div className="flex overflow-x-auto px-4 py-2 space-x-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
          
          {/* Mobile settings shortcut */}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="flex items-center space-x-2 px-3 py-2 whitespace-nowrap"
            >
              <Link to="/admin">
                <ShieldCheck className="w-4 h-4" />
                <span>Admin</span>
              </Link>
            </Button>
          )}
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