// Social Variant Preview — shows content adapted per social channel
export default function SocialVariantPreview({ channel }: { channel: string }) {
  return (
    <div className="p-4 border rounded-lg">
      <h4 className="font-medium capitalize">{channel}</h4>
      <p className="text-gray-500 text-sm">Preview will be implemented in a later task.</p>
    </div>
  );
}
