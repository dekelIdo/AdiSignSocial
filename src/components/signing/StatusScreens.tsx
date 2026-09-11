import Link from "next/link";

type LoadingScreenProps = {
  clientName?: string;
  /** 0..1, or null when the size is unknown. */
  progress: number | null;
};

export function LoadingScreen({ clientName, progress }: LoadingScreenProps) {
  const percent = progress === null ? null : Math.round(progress * 100);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10 text-center">
      <span className="brand-mark mb-8" aria-hidden>
        ע
      </span>
      {clientName ? <p className="text-xl text-muted">שלום {clientName},</p> : null}
      <h1 className="mt-1 text-4xl font-semibold tracking-[-0.02em] text-ink sm:text-5xl">
        הסכם העבודה שלך
      </h1>
      <p className="mt-3 text-xl text-ink-soft">כמה רגעים וזה מוכן ✨</p>

      <div className="mt-10 w-full max-w-xs" aria-live="polite">
        <div
          className={`progress ${percent === null ? "progress--indeterminate" : ""}`}
          role="progressbar"
          aria-label="טעינת ההסכם"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
        >
          <span style={percent === null ? undefined : { width: `${Math.max(percent, 4)}%` }} />
        </div>
        <p className="mt-4 text-lg font-semibold text-ink-soft">
          מכינה את ההסכם שלך…{percent !== null && percent > 0 ? ` ${percent}%` : ""}
        </p>
      </div>
    </main>
  );
}

type ErrorScreenProps = {
  title: string;
  message: string;
  onRetry?: () => void;
};

export function ErrorScreen({ title, message, onRetry }: ErrorScreenProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10">
      <section className="card w-full max-w-md px-6 py-10 text-center sm:px-10" role="alert">
        <span className="brand-mark mb-6" aria-hidden>
          ע
        </span>
        <h1 className="text-3xl font-semibold leading-tight text-ink">{title}</h1>
        <p className="mt-4 text-xl leading-relaxed text-ink-soft">{message}</p>
        {onRetry ? (
          <button type="button" className="btn btn-primary btn-lg btn-block mt-8" onClick={onRetry}>
            לנסות שוב
          </button>
        ) : null}
      </section>
    </main>
  );
}

export function MissingLinkScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10">
      <section className="card w-full max-w-md px-6 py-10 text-center sm:px-10">
        <span className="brand-mark mb-6" aria-hidden>
          ע
        </span>
        <h1 className="text-3xl font-semibold leading-tight text-ink">הקישור הזה כבר לא פעיל</h1>
        <p className="mt-4 text-xl leading-relaxed text-ink-soft">
          אפשר לבקש מעדי לשלוח קישור חדש, וזה ייפתח מיד.
        </p>
        <Link href="/" className="btn btn-secondary mt-8">
          לעמוד הראשי
        </Link>
      </section>
    </main>
  );
}
