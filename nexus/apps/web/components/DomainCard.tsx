// Domain Card component — displays a single domain on the home page
export default function DomainCard({ name, icon }: { name: string; icon?: string }) {
  return (
    <div className="p-6 border rounded-xl hover:shadow-lg transition-shadow cursor-pointer">
      {icon && <span className="text-2xl mb-2 block">{icon}</span>}
      <h3 className="text-lg font-semibold">{name}</h3>
    </div>
  );
}
