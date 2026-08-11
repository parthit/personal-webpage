import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Selected projects and experiments by Parthit Patel across software engineering and product building.",
  alternates: {
    canonical: "/projects",
  },
  openGraph: {
    title: "Projects · Parthit Patel",
    description:
      "Selected projects and experiments by Parthit Patel across software engineering and product building.",
    url: "/projects",
    type: "website",
  },
};

export default function ProjectsPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        This will be projects page
      </div>
    </main>
  );
}
