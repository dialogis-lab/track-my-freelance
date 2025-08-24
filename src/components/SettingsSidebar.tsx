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
    <Sidebar className="w-60">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.path} 
                      end={item.exact}
                      className={({ isActive }) => 
                        isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
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