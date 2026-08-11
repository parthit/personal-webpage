import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { MDXImage } from "./MDXImage";
import { YouTube } from "../YouTube";
import { BTreeVisualizer } from "./BTreeVisualizer";
import { BTreeIndexDemo } from "./BTreeIndexDemo";

export const mdxComponents: MDXComponents = {
  h1: (props) => (
    <h1 className="mb-4 mt-10 text-3xl font-semibold tracking-tight" {...props} />
  ),
  h2: (props) => (
    <h2 className="mb-3 mt-8 text-2xl font-semibold tracking-tight" {...props} />
  ),
  h3: (props) => (
    <h3 className="mb-2 mt-6 text-xl font-semibold" {...props} />
  ),
  p: (props) => (
    <p className="mb-4 leading-relaxed text-gray-800 dark:text-gray-200" {...props} />
  ),
  ul: (props) => (
    <ul className="mb-4 list-disc space-y-2 pl-6" {...props} />
  ),
  ol: (props) => (
    <ol className="mb-4 list-decimal space-y-2 pl-6" {...props} />
  ),
  li: (props) => <li className="leading-relaxed" {...props} />,
  a: ({ href = "", children, ...props }) => {
    const className =
      "text-blue-600 underline-offset-2 hover:underline dark:text-blue-400";
    const isInternal = href.startsWith("/");
    if (isInternal) {
      return (
        <Link href={href} className={className} {...props}>
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    );
  },
  blockquote: (props) => (
    <blockquote
      className="my-6 border-l-4 border-gray-300 pl-4 italic text-gray-700 dark:border-gray-600 dark:text-gray-300"
      {...props}
    />
  ),
  code: (props) => (
    <code
      className="rounded bg-gray-200 px-1.5 py-0.5 text-sm dark:bg-gray-800"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="mb-6 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100"
      {...props}
    />
  ),
  hr: () => <hr className="my-8 border-gray-300 dark:border-gray-700" />,
  img: (props) => <MDXImage {...props} />,
  YouTube,
  BTreeVisualizer,
  BTreeIndexDemo,
};
