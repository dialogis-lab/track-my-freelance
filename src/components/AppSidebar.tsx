import { Link, useLocation } from 'react-router-dom';
import { Clock, Users, FolderOpen, BarChart3, Receipt, Settings, ShieldCheck, Crown } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { usePlan } from '@/hooks/usePlan';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const mainNavItems = [
  { title: 'Dashboard', url: '/dashboard', icon: Clock },
  { title: 'Projects', url: '/projects', icon: FolderOpen },
  { title: 'Clients', url: '/clients', icon: Users },
  { title: 'Reports', url: '/reports', icon: BarChart3 },
  { title: 'Invoices', url: '/invoices', icon: Receipt },
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { isFree } = usePlan();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const isMainNavExpanded = mainNavItems.some((item) => isActive(item.url));
  const isCollapsed = state === "collapsed";

  const getNavClasses = (active: boolean) => {
    return active 
      ? "bg-primary/10 text-primary font-medium border-r-2 border-primary" 
      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground";
  };

  return (
    <Sidebar
      collapsible="icon"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? "sr-only" : ""}>
            Navigation
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link 
                      to={item.url} 
                      className={getNavClasses(isActive(item.url))}
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Section */}
        {!roleLoading && isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className={isCollapsed ? "sr-only" : ""}>
              Admin
            </SidebarGroupLabel>
            
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link 
                      to="/admin" 
                      className={getNavClasses(currentPath.startsWith('/admin'))}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {!isCollapsed && <span>Admin Panel</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Upgrade Section for Free Users */}
        {isFree && (
          <SidebarGroup>
            <SidebarGroupLabel className={isCollapsed ? "sr-only" : ""}>
              Upgrade
            </SidebarGroupLabel>
            
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link 
                      to="/settings" 
                      className="hover:bg-primary/10 text-primary font-medium"
                    >
                      <Crown className="h-4 w-4" />
                      {!isCollapsed && <span>Upgrade Plan</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}