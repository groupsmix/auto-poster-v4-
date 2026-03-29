// Category Card component — displays a single category within a domain
export default function CategoryCard({ name }: { name: string }) {
  return (
    <div className="p-6 border rounded-xl hover:shadow-lg transition-shadow cursor-pointer">
      <h3 className="text-lg font-semibold">{name}</h3>
    </div>
  );
}
