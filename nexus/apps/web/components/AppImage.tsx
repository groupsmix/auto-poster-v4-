/**
 * AppImage — drop-in replacement for <img> that suppresses the
 * @next/next/no-img-element lint rule.
 *
 * Next.js `<Image>` requires width/height or a loader, which doesn't
 * work for dynamic R2/CF Images URLs in a static-export app.
 * Using a shared component keeps the eslint-disable in one place
 * instead of scattered across every file.
 */

/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */
import type { ImgHTMLAttributes } from "react";

export default function AppImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  return <img {...props} />;
}
