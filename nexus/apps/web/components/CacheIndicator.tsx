// V4: Cache Indicator — shows cache hit/miss status
export default function CacheIndicator({ hit }: { hit: boolean }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${hit ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
      {hit ? "CACHE HIT" : "CACHE MISS"}
    </span>
  );
}
