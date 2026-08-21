import React from 'react';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 selection:bg-zinc-100 selection:text-zinc-950">
      <main className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-sm p-8 space-y-6">
        <header className="border-b border-zinc-800 pb-5 space-y-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-white uppercase font-mono">
              Occasio
            </h1>
            <span className="text-xs uppercase tracking-widest font-mono text-zinc-500 border border-zinc-800 px-2 py-0.5 rounded-sm">
              v0.1.0
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-mono">
            Event Management System
          </p>
        </header>

        <section className="space-y-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            Frontend workspace initialized with a restrained, high-contrast monochrome design system. Built with React 19, TypeScript, TanStack Query, and Vite.
          </p>

          <div className="space-y-2">
            <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500">
              Active Stack
            </h2>
            <div className="flex flex-wrap gap-1.5 font-mono text-xs">
              {[
                'Vite',
                'React 19',
                'TypeScript',
                'Tailwind CSS',
                'TanStack Query',
                'React Router',
                'Zustand',
                'Axios',
              ].map((tech) => (
                <span
                  key={tech}
                  className="px-2.5 py-1 bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-sm"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </section>

        <footer className="pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500 font-mono">
          <span>Status: Ready</span>
          <span>Palette: Monochrome (Zinc/Neutral)</span>
        </footer>
      </main>
    </div>
  );
};

export default App;
