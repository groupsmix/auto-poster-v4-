import PlatformsClient from "./_client";

export default function PlatformsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Platform Manager</h1>
        <p className="text-muted text-sm mt-1">
          Configure platform rules for listing variation
        </p>
      </div>
      <PlatformsClient />
    </div>
  );
}
