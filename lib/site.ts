/** Canonical site URL used for metadata, sitemap, and robots. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://www.parthitpatel.com";

export const SITE_NAME = "Parthit Patel";

export const SITE_TITLE = "Parthit Patel — Fullstack Engineer";

export const SITE_DESCRIPTION =
  "Portfolio of Parthit Patel, fullstack engineer at Intuit. Writing and videos on system design, scalable products, and building for small businesses.";

export const SITE_KEYWORDS = [
  "Parthit Patel",
  "fullstack engineer",
  "system design",
  "Intuit",
  "QuickBooks",
  "Cornell Tech",
  "portfolio",
  "software engineering",
];

export const SOCIAL = {
  linkedin: "https://www.linkedin.com/in/parthit/",
  twitter: "https://x.com/parthitp",
  twitterHandle: "@parthitp",
  email: "parthitpatel@gmail.com",
} as const;

/** Default raster image for Open Graph / Twitter cards. */
export const DEFAULT_OG_IMAGE = "/content/images/parthit.jpeg";

export function absoluteUrl(path = "/") {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized === "/" ? "" : normalized}` || SITE_URL;
}

/**
 * Social platforms often skip SVG link-preview images.
 * Prefer raster covers; otherwise fall back to the default OG image.
 */
export function socialShareImage(cover?: string, alt = SITE_NAME) {
  const candidate = cover?.trim();
  const isSvg = !!candidate && /\.svg(?:$|\?)/i.test(candidate);
  const url = !candidate || isSvg ? DEFAULT_OG_IMAGE : candidate;

  return {
    url,
    alt: !candidate || isSvg ? SITE_NAME : alt,
  };
}
