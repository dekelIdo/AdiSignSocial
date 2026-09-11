import { UploadCard } from "@/components/UploadCard";

export default function Home() {
  return (
    <main className="min-h-dvh px-5 py-8 sm:px-8 sm:py-12">
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center">
        <div className="mb-10 flex items-center gap-3" aria-label="עדי">
          <span className="brand-mark" aria-hidden>
            ע
          </span>
          <span className="text-lg font-semibold">עדי</span>
        </div>

        <div className="max-w-2xl text-center">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-6xl">
            יצירת קישור לחתימה
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-xl leading-relaxed text-ink-soft sm:text-2xl">
            בחרי את ההסכם, ותקבלי קישור לשליחה ללקוחה בוואטסאפ. היא פותחת, קוראת וחותמת עם
            האצבע.
          </p>
        </div>

        <div className="mt-10 w-full">
          <UploadCard />
        </div>
      </section>
    </main>
  );
}
