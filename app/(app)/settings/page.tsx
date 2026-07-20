import { DeleteAllButton } from "@/components/delete-all-button";
import { MagicLinkForm } from "@/components/magic-link-form";

/*
 * Settings (WF §18). Phase 2 ships the data-rights core: account upgrade
 * (magic link), export, hard delete. Motion/theme/notification toggles
 * complete in Phase 8.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  const { auth } = await searchParams;

  return (
    <section className="flex max-w-xl flex-col items-start gap-s6">
      <h1 className="font-display text-2xl">Settings</h1>

      {auth === "invalid" || auth === "error" ? (
        <p
          role="alert"
          className="rounded-card border border-alert bg-paper2 px-s4 py-s3 text-alert"
        >
          That sign-in link didn&apos;t work — it may have expired. Request a
          fresh one below.
        </p>
      ) : null}

      <div className="ticket-surface w-full p-s5">
        <MagicLinkForm />
      </div>

      <div className="ticket-surface w-full p-s5">
        <h2 className="font-display text-lg">Your data</h2>
        <p className="mt-s2 text-sm text-ink-soft">
          Wanderlost stores only your pretend trips and (optionally) your
          email. Take it all with you, or make it vanish.
        </p>
        <div className="mt-s4 flex flex-wrap items-center gap-s3">
          <a
            href="/api/export"
            download
            className="press-physical inline-flex min-h-11 items-center rounded-pill bg-ink px-s4 font-semibold text-paper2"
          >
            Export my data (JSON)
          </a>
          <DeleteAllButton />
        </div>
      </div>

      <p className="text-sm text-ink-soft">
        Reduced motion, night-flight theme, and notification preferences land
        in Phase 8.
      </p>
    </section>
  );
}
