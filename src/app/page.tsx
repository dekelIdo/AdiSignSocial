import { UploadCard } from "@/components/UploadCard";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen px-5 py-10 text-[#2F2F2F] sm:px-8 sm:py-14">
      <section className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-6xl flex-col items-center justify-center">
        <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-[#ECE7E1] bg-white/75 px-5 py-2.5 text-sm font-semibold text-[#7B7B7B] shadow-[0_18px_60px_rgba(47,47,47,0.05)] backdrop-blur">
          <Sparkles className="size-4 text-[#BBDDFA]" aria-hidden />
          חתימה נעימה למסמכים חשובים
        </div>

        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-5xl font-semibold leading-[1.02] tracking-[-0.035em] text-[#2F2F2F] sm:text-7xl lg:text-8xl">
            חוזים שנחתמים בשקט.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-xl leading-9 text-[#7B7B7B] sm:text-2xl sm:leading-10">
            מעלים מסמך, שולחים קישור אחד, ומקבלים אותו חתום במייל.
            בלי התחברות. בלי התקנה. בלי תחושה של תוכנה.
          </p>
        </div>

        <div className="mt-14 w-full">
          <UploadCard />
        </div>

        <div className="mt-10 grid w-full max-w-4xl gap-3 text-center text-sm font-semibold text-[#7B7B7B] sm:grid-cols-3">
          <div className="rounded-3xl border border-[#ECE7E1] bg-white/65 px-5 py-4 shadow-[0_14px_40px_rgba(47,47,47,0.04)]">
            מעלים PDF
          </div>
          <div className="flex items-center justify-center gap-2 rounded-3xl border border-[#ECE7E1] bg-white/65 px-5 py-4 shadow-[0_14px_40px_rgba(47,47,47,0.04)]">
            שולחים קישור <ArrowLeft className="size-4" aria-hidden />
          </div>
          <div className="rounded-3xl border border-[#ECE7E1] bg-white/65 px-5 py-4 shadow-[0_14px_40px_rgba(47,47,47,0.04)]">
            מקבלים מסמך חתום
          </div>
        </div>
      </section>
    </main>
  );
}
