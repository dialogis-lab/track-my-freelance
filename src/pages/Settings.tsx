import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { SettingsSidebar } from '@/components/SettingsSidebar';
import { ProfileForm } from '@/components/ProfileForm';
import { SettingsAccount } from '@/components/SettingsAccount';
import { SettingsTimerStyle } from '@/components/SettingsTimerStyle';
import { SettingsReminders } from '@/components/SettingsReminders';
import { SettingsCurrency } from '@/components/SettingsCurrency';
import { SettingsTimezone } from '@/components/SettingsTimezone';
import { SettingsSecurity } from '@/components/SettingsSecurity';
import { SettingsCookies } from '@/components/SettingsCookies';
import { SettingsAbout } from '@/components/SettingsAbout';

export default function Settings() {
  return (
    <AppLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences.</p>
        </div>

        <div className="flex min-h-[600px] w-full rounded-xl border bg-card shadow-sm overflow-hidden">
          <SettingsSidebar />
          
          <main className="flex-1 p-6 bg-background">
            <div className="animate-fade-in">
              <Routes>
                <Route path="/" element={<ProfileForm />} />
                <Route path="/account" element={<SettingsAccount />} />
                <Route path="/timer-style" element={<SettingsTimerStyle />} />
                <Route path="/reminders" element={<SettingsReminders />} />
                <Route path="/currency" element={<SettingsCurrency />} />
                <Route path="/timezone" element={<SettingsTimezone />} />
                <Route path="/security" element={<SettingsSecurity />} />
                <Route path="/cookies" element={<SettingsCookies />} />
                <Route path="/about" element={<SettingsAbout />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </AppLayout>
  );
}