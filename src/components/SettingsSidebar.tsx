import { NavLink } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Building2, User, Bell, DollarSign, Clock, Shield, Info, Cookie } from 'lucide-react';

const settingsItems = [
  { title: "Profile", path: "/settings", icon: Building2, exact: true },
  { title: "Account", path: "/settings/account", icon: User },
  { title: "Reminders", path: "/settings/reminders", icon: Bell },
  { title: "Currency", path: "/settings/currency", icon: DollarSign },
  { title: "Time Zone", path: "/settings/timezone", icon: Clock },
  { title: "Security", path: "/settings/security", icon: Shield },
  { title: "Cookies", path: "/settings/cookies", icon: Cookie },
  { title: "About", path: "/settings/about", icon: Info },
];

export function SettingsSidebar() {
  return (
    <Sidebar className="w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarContent className="p-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Settings
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.path} 
                      end={item.exact}
                      className={({ isActive }) => 
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-accent hover:text-accent-foreground group ${
                          isActive 
                            ? "bg-primary text-primary-foreground shadow-sm" 
                            : "text-muted-foreground hover:text-foreground"
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                      <span className="transition-all duration-200">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}