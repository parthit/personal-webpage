/* eslint-disable react/no-unescaped-entities */
import Image from "next/image";

export default function Home() {
  return (
    // <main className="flex min-h-screen flex-col items-center justify-between p-24">
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">hey, I'm Parthit 👋</h1>
      <p className="mb-4">
        I'm a frontend developer, optimist, and community builder. I currently work as a Fullstack Engineer at Intuit, where I help build solutions for the Quickbooks Online platform.
      </p>
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Add your images here */}
        {/* <Image src="/placeholder1.jpg" alt="Placeholder 1" width={300} height={200} className="rounded-lg" />
        <Image src="/placeholder2.jpg" alt="Placeholder 2" width={300} height={200} className="rounded-lg" /> */}
        {/* Add more images as needed */}
      </div>
      <p>
        Some other content that I will have to write.
      </p>
    </div>
    // </main>
  );
}
