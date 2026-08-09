"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "home", href: "/" },
  { label: "writing", href: "/writing" },
  { label: "videos", href: "/videos" },
  { label: "chat", href: "/chat" },
] as const;

const Header = () => {
  const pathname = usePathname();

  return (
    <header className="mx-auto mb-5 max-w-2xl">
      <nav className="container py-4">
        <ul className="flex flex-wrap justify-start gap-x-6 gap-y-2">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`transition-colors duration-200 ${
                    active
                      ? "font-bold text-gray-900 dark:text-white"
                      : "text-gray-600 hover:font-bold hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
};

export default Header;
