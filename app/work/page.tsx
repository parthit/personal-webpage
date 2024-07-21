/* eslint-disable react/no-unescaped-entities */
export default function Work() {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">my work</h1>
        <p className="mb-4">
          On a mission to build products developers love, and along the way, teach the next generation of developers. Here's a summary of my work so far.
        </p>
        
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-2">[Your Current Company]</h2>
          <p className="text-gray-600 mb-2">[Your Position]</p>
          <p className="mb-4">
            [Description of your role and achievements]
          </p>
          <ul className="list-disc pl-5">
            <li>[Achievement 1]</li>
            <li>[Achievement 2]</li>
            <li>[Achievement 3]</li>
          </ul>
        </section>
        
        {/* Add more sections for previous work experiences */}
      </div>
    )
  }