// V4: AI Health Bar — visualizes model reliability score (0-100)
export default function AIHealthBar({ score, name }: { score: number; name: string }) {
  const color = score >= 90 ? "bg-green-500" : score >= 70 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium w-32 truncate">{name}</span>
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm text-gray-600 w-10 text-right">{score}%</span>
    </div>
  );
}
