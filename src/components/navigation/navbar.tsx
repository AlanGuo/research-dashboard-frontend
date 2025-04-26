'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: '主页', href: '/' },
    { name: '全球流动性', href: '/gli' },
  ];

  return (
    <nav className="bg-background border-b">
      <div className="container mx-auto px-4 max-w-[1920px]">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold">经济实验室</span>
            </Link>
          </div>
          
          <div>
            <div className="flex items-center space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'px-3 py-2 rounded-md text-sm font-medium',
                    pathname === item.href
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/60 hover:text-foreground hover:bg-accent'
                  )}
                >
                  {item.name}
                </Link>
              ))}
              <div className="ml-2">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
