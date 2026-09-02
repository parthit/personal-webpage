"use client"

import Cal from "@calcom/embed-react";

export default function Home() {
  return (
    <div className="mx-auto min-w-0 max-w-2xl">
      <header className="mb-8">
        <h1 className="mb-3 text-3xl font-semibold">Let’s connect</h1>
        <p className="text-gray-700 dark:text-gray-300">
          Want to talk software, AI, or small-business products? Pick a time
          that works.
        </p>
      </header>
      <Cal calLink="parthit-patel"></Cal>
    </div>
  );
}
