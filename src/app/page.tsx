import { LinkWizard } from "@/components/owner/LinkWizard";

export default function Home() {
  return (
    <main className="min-h-dvh px-3 py-6 sm:px-8 sm:py-10">
      <section className="mx-auto flex w-full max-w-[52rem] flex-col items-center">
        <div className="mb-6 flex items-center gap-3" aria-label="עדי">
          <span className="brand-mark" aria-hidden>
            ע
          </span>
          <span className="text-lg font-semibold">עדי</span>
        </div>

        <div className="mb-6 max-w-2xl text-center">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-5xl">
            יצירת קישור לחתימה
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
            בוחרים הסכם, מסמנים איפה חותמים, ושולחים קישור.
          </p>
        </div>

        <div className="w-full">
          <LinkWizard />
        </div>
      </section>
    </main>
  );
}
