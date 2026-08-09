import Image from "next/image";

type MDXImageProps = {
  src?: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
};

/**
 * Maps markdown images to next/image.
 * Use absolute public paths, e.g. /content/images/writing/<slug>/diagram.svg
 */
export function MDXImage({
  src = "",
  alt = "",
  width = 720,
  height = 405,
}: MDXImageProps) {
  if (!src) return null;

  const parsedWidth = typeof width === "string" ? Number(width) || 720 : width;
  const parsedHeight =
    typeof height === "string" ? Number(height) || 405 : height;

  const isSvg = src.split("?")[0]?.toLowerCase().endsWith(".svg") ?? false;

  return (
    <span className="my-8 block">
      <Image
        src={src}
        alt={alt}
        width={parsedWidth}
        height={parsedHeight}
        className="h-auto w-full rounded-lg"
        sizes="(max-width: 768px) 100vw, 672px"
        unoptimized={isSvg}
      />
    </span>
  );
}
