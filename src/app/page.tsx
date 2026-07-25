import { UploadCard } from "@/components/UploadCard";

export default function Home() {
  return (
    <main className="min-h-screen px-5 py-8 text-[#2E2E2E] sm:px-8 sm:py-12">
      <section className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-4xl flex-col items-center justify-center">
        <div className="mb-12 flex items-center gap-3 text-[#2E2E2E]" aria-label="עדי">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#E9DCCF] text-xl font-bold">
            ע
          </div>
          <div className="text-lg font-semibold tracking-[-0.01em]">עדי</div>
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-[-0.035em] text-[#2E2E2E] sm:text-7xl">
            ההסכם שלך לחתימה
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-xl leading-9 text-[#757575] sm:text-2xl sm:leading-10">
            נשאר רק לעבור על ההסכם, לחתום במקום המסומן ולשלוח.
          </p>
          <p className="mt-5 text-xl font-semibold text-[#2E2E2E]">כדקה אחת בלבד.</p>
        </div>

        <div className="mt-14 w-full">
          <UploadCard />
        </div>
      </section>
    </main>
  );
}
