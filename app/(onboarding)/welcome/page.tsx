import { acknowledgeSimulationAction } from "@/actions/auth";

/*
 * Simulation disclosure (docs/APP_WORKFLOW.md §2, US-1). One screen, plain
 * language, unskippable acknowledge. Submitting creates the guest session.
 */
export default function WelcomePage() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-start justify-center gap-s5 px-s5"
    >
      <p className="rounded-pill border border-line bg-paper2 px-s3 py-s1 font-mono text-xs font-semibold tracking-widest text-stamp-red uppercase">
        Before you board
      </p>
      <h1 className="font-display text-3xl">
        Everything here is a beautiful lie.
      </h1>
      <div className="space-y-s3 text-lg text-ink-soft">
        <p>
          No real flights. No real hotels. No payment — <em>ever</em>. The
          airlines are made up, the prices are pretend, and your card stays in
          your pocket because we will never ask for it.
        </p>
        <p>
          What you get is the fun part: searching, choosing, booking,
          counting down. Science says anticipating a trip is often the
          happiest part of travel. This whole app is that part.
        </p>
      </div>
      <form action={acknowledgeSimulationAction}>
        <button
          type="submit"
          className="press-physical inline-flex min-h-12 items-center rounded-pill bg-sunset px-s6 py-s3 text-lg font-semibold text-ink shadow-e2 hover:bg-sunset-deep hover:text-paper2"
        >
          I understand — let&apos;s dream
        </button>
      </form>
      <p className="text-sm text-ink-soft">
        By continuing you get a guest passport (a cookie). No account, no
        email needed. You can add an email later just to receive pretend
        boarding passes.
      </p>
    </main>
  );
}
