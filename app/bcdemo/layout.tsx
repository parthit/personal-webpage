import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SHA-256 mining demo",
  description:
    "Interactive demonstration of brute-force SHA-256 proof of work using a nonce and trailing zeros.",
  robots: { index: false, follow: false },
};

export default function BcDemoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
