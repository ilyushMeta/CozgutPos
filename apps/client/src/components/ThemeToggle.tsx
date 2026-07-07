import { useEffect, useState } from 'react';

/** Dark/light theme toggle (SPEC §9 — legacy PosUI had both). */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean>(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="px-2 py-1 rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
      aria-label="theme"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
