import SettingsClient from "./_client";

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted text-sm mt-1">
          System configuration and preferences
        </p>
      </div>
      <SettingsClient />
    </div>
  );
}
