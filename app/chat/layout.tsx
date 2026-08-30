import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Find a time to chat with Parthit Patel about software, AI, or small-business products.",
  alternates: {
    canonical: "/chat",
  },
  openGraph: {
    title: "Contact · Parthit Patel",
    description:
      "Find a time to chat with Parthit Patel about software, AI, or small-business products.",
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
