import type { Metadata } from "next";
import Link from "next/link";

const projects = [
  {
    title: "AugmentED",
    description:
      "An edtech startup I helped build at Cornell Tech. We started with a rough idea, tested it with students, and learned a lot about the distance between a promising prototype and a useful product.",
    href: "https://augmentedcornell.github.io/UnityWebApp/",
    linkLabel: "Visit AugmentED",
    external: true,
  },
  {
    title: "Applied AI Playgrounds",
    description:
      "Two interactive experiments: one matches messy invoice text to fields, and the other compares a small vision detector with a VLM.",
    href: "/writing/document-ai-field-matching",
    linkLabel: "Explore the Document AI playground",
    external: false,
  },
  {
    title: "Systems Visualizations",
    description:
      "Small visualizations I built while learning replication, quorums, and B-tree indexes. Clicking through them helped the ideas stick better than another page of notes.",
    href: "/writing/replication",
    linkLabel: "Explore the replication walkthrough",
    external: false,
  },
] as const;

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Projects and small software experiments by Parthit Patel.",
  alternates: {
    canonical: "/projects",
  },
  openGraph: {
    title: "Projects · Parthit Patel",
    description:
      "Projects and small software experiments by Parthit Patel.",
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
          A few things I’ve built, at work, at school, and out of curiosity.
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
