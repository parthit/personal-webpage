import type { Metadata } from "next";
import Link from "next/link";

const projects = [
  {
    title: "AugmentED",
    description:
      "An education technology startup developed at Cornell Tech. The experience covered product discovery, user feedback, and building an interactive learning product from an early-stage idea.",
    href: "https://augmentedcornell.github.io/UnityWebApp/",
    linkLabel: "Visit AugmentED",
    external: true,
  },
  {
    title: "Applied AI Playgrounds",
    description:
      "Interactive explainers for document field matching and real-time computer vision, with explicit assumptions, evaluation strategies, and production trade-offs.",
    href: "/writing/document-ai-field-matching",
    linkLabel: "Explore the Document AI playground",
    external: false,
  },
  {
    title: "Systems Visualizations",
    description:
      "Hands-on visualizations of replication, consistency, quorums, and B-tree indexes designed to make distributed-systems and database concepts easier to reason about.",
    href: "/writing/replication",
    linkLabel: "Explore the replication walkthrough",
    external: false,
  },
] as const;

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
    <div className="mx-auto max-w-2xl">
      <header className="mb-10">
        <h1 className="mb-3 text-3xl font-semibold">Projects</h1>
        <p className="text-gray-700 dark:text-gray-300">
          Selected work across product engineering, applied AI, and systems
          education.
        </p>
      </header>

      <div className="space-y-10">
        {projects.map((project) => (
          <article key={project.title}>
            <h2 className="mb-2 text-xl font-semibold">{project.title}</h2>
            <p className="mb-3 text-gray-700 dark:text-gray-300">
              {project.description}
            </p>
            <Link
              href={project.href}
              className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
              {...(project.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {project.linkLabel} →
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
