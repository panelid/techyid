import PasskeyManager from "@/components/PasskeyManager";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-sm text-gray-600 mb-2">Kelola akun dan keamanan login.</p>
        <PasskeyManager />
      </div>
    </div>
  );
}