import { PrimaryNav } from "@/components/layout/PrimaryNav";

export default function Settings() {
  return (
    <div className="min-h-screen bg-background">
      <PrimaryNav />
      <main className="container px-6 py-8">
        <h1 className="text-3xl font-bold mb-4">Settings</h1>
        <p className="text-muted-foreground">Settings coming soon...</p>
      </main>
    </div>
  );
}
