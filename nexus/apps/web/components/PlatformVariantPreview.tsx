// Platform Variant Preview — shows content adapted per platform
export default function PlatformVariantPreview({ platform }: { platform: string }) {
  return (
    <div className="p-4 border rounded-lg">
      <h4 className="font-medium capitalize">{platform}</h4>
      <p className="text-gray-500 text-sm">Preview will be implemented in a later task.</p>
    </div>
  );
}
