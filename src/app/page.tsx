export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 px-6">
      <p className="text-sm font-medium uppercase tracking-[0.12em] text-stone-600">Leadscale · Shared setup</p>
      <h1 className="text-4xl font-semibold tracking-tight text-stone-950">Real estate lead prioritization</h1>
      <p className="max-w-xl text-lg leading-7 text-stone-700">
        Contract and mock API are ready. Explore <code>/api/leads</code>, <code>/api/prioritize</code>, and <code>/api/health</code>.
      </p>
    </main>
  );
}