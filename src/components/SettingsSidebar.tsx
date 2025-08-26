import { NavLink } from 'react-router-dom';
import { Building2, User, Bell, DollarSign, Clock, Shield, Info, Cookie, CreditCard } from 'lucide-react';

const settingsItems = [
  { title: "Profile", path: "/settings", icon: Building2, exact: true },
  { title: "Account", path: "/settings/account", icon: User },
  { title: "Subscription", path: "/settings/subscription", icon: CreditCard },
  { title: "Reminders", path: "/settings/reminders", icon: Bell },
  { title: "Currency", path: "/settings/currency", icon: DollarSign },
  { title: "Time Zone", path: "/settings/timezone", icon: Clock },
  { title: "Security", path: "/settings/security", icon: Shield },
  { title: "Cookies", path: "/settings/cookies", icon: Cookie },
  { title: "About", path: "/settings/about", icon: Info },
];

export function SettingsSidebar() {
  return (
    <div className="w-64 border-r border-gray-200 bg-gray-50 min-h-full">
      <div className="p-4">
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Settings
          </h3>
          <nav className="space-y-1">
            {settingsItems.map((item) => (
              <NavLink 
                key={item.title}
                to={item.path} 
                end={item.exact}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                    isActive 
                      ? "bg-gradient-to-r from-blue-500 via-teal-500 to-green-500 text-white shadow-sm" 
                      : "text-gray-900 hover:bg-white hover:shadow-sm"
                  }`
                }
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span>{item.title}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}