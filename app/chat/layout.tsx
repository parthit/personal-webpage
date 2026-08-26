import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Book a conversation with Parthit Patel to talk about engineering, system design, or building products.",
  alternates: {
    canonical: "/chat",
  },
  openGraph: {
    title: "Contact · Parthit Patel",
    description:
      "Book a conversation with Parthit Patel to talk about engineering, system design, or building products.",
    url: "/chat",
    type: "website",
  },
};

export default function ChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
