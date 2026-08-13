import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { MDXImage } from "./MDXImage";
import { YouTube } from "../YouTube";
import { BTreeVisualizer } from "./BTreeVisualizer";
import { BTreeIndexDemo } from "./BTreeIndexDemo";
import { LeaderFollowerDemo } from "./LeaderFollowerDemo";
import { StaleReadDemo } from "./StaleReadDemo";
import { MultiLeaderDemo } from "./MultiLeaderDemo";
import { QuorumDemo } from "./QuorumDemo";

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
      className="rounded bg-gray-200 px-1.5 py-0.5 text-[0.9em] text-gray-900 dark:bg-gray-800 dark:text-gray-100"
      {...props}
    />
  ),
  // Light, high-contrast blocks so nested <code> never paints white-on-white.
  // [&_code] clears the inline-code chip styles used inside fenced blocks.
  pre: (props) => (
    <pre
      className="mb-6 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-[13px] leading-relaxed text-gray-900 sm:p-4 sm:text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit [&_code]:rounded-none"
      {...props}
    />
  ),
  table: (props) => (
    <div className="mb-6 w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table
        className="w-full min-w-[28rem] border-collapse text-left text-sm"
        {...props}
      />
    </div>
  ),
  thead: (props) => (
    <thead
      className="bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100"
      {...props}
    />
  ),
  tbody: (props) => <tbody {...props} />,
  tr: (props) => (
    <tr className="border-t border-gray-200 dark:border-gray-700" {...props} />
  ),
  th: (props) => (
    <th className="px-3 py-2.5 font-semibold whitespace-nowrap" {...props} />
  ),
  td: (props) => (
    <td className="px-3 py-2.5 align-top text-gray-800 dark:text-gray-200" {...props} />
  ),
  hr: () => <hr className="my-8 border-gray-300 dark:border-gray-700" />,
  img: (props) => <MDXImage {...props} />,
  YouTube,
  BTreeVisualizer,
  BTreeIndexDemo,
  LeaderFollowerDemo,
  StaleReadDemo,
  MultiLeaderDemo,
  QuorumDemo,
};
