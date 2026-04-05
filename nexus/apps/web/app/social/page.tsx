import SocialClient from "./_client";

export default function SocialPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Social Channels</h1>
        <p className="text-muted text-sm mt-1">
          Configure social media channels and posting rules
        </p>
      </div>
      <SocialClient />
    </div>
  );
}
