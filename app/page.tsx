export default function Home() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 px-6 py-24 font-sans text-zinc-950 dark:bg-black dark:text-zinc-50">
      <section className="w-full max-w-3xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-12">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          cloud-agents-demo-live
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Live demo workspace for cloud coding agents.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          Use this Next.js app to preview how cloud agents update a running
          project, review concise code changes, and prepare the demo for a live
          deployment.
        </p>
        <div className="mt-8 flex flex-col gap-3 text-base font-medium sm:flex-row">
          <a
            className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-950 px-6 text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-300"
            href="https://vercel.com/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            Deploy on Vercel
          </a>
          <a
            className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 px-6 transition-colors hover:border-zinc-950 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:border-zinc-50 dark:hover:bg-zinc-900"
            href="https://nextjs.org/docs/app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read Next.js app docs
          </a>
        </div>
        <div className="mt-8 rounded-2xl bg-zinc-100 p-5 font-mono text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <p>Run locally: npm run dev</p>
          <p className="mt-2">Build for production: npm run build</p>
        </div>
      </section>
    </main>
  );
}
