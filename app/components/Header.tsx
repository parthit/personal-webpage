import Link from 'next/link'

const Header = () => {
  return (
    <header className="max-w-2xl mx-auto mb-5">
      <nav className="container py-4">
        <ul className="flex justify-start space-x-6">
          {['home', 'work', 'contact'].map((item) => (
            <li key={item}>
              <Link href={`/${item === 'home' ? '' : item}`} className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors duration-200">
                {item}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}

export default Header
