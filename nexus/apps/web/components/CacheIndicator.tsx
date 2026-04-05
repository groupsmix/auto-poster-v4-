// V4: Cache Indicator — shows cache hit/miss status
export default function CacheIndicator({ hit }: { hit: boolean }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${hit ? "bg-blue-500/10 text-blue-400" : "bg-gray-500/10 text-gray-400"}`}>
      {hit ? "CACHE HIT" : "CACHE MISS"}
    </span>
  );
}
