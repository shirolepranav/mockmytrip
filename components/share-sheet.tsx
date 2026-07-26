"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/sheet";
import { Toast } from "@/components/toast";
import { IconShare } from "@/components/icons";
import {
  createShareAction,
  removeCollaboratorAction,
  revokeShareAction,
  setCollaboratorRoleAction,
  setPermissionAction,
} from "@/actions/shares";
import type { CollaboratorRole, CollaboratorView, SharePermission, TripShareRow } from "@/lib/services/shares";

/*
 * Share sheet (WF §20b): permission selector + generate, active-links list
 * (view count, permission toggle, revoke), collaborators list (role
 * downgrade/remove). Plain confirms throughout — no shaming copy, no
 * referral/growth framing (golden rule #8) anywhere in this component.
 *
 * Mutations refresh the owner-only lists via `router.refresh()` rather
 * than hand-rolled client-side cache sync — this sheet's data is small and
 * infrequently changed, so the simplicity is worth the extra round trip.
 */
export function ShareSheet({
  tripId,
  initialShares,
  initialCollaborators,
}: {
  tripId: string;
  initialShares: TripShareRow[];
  initialCollaborators: CollaboratorView[];
}) {
  const [open, setOpen] = useState(false);
  const [permission, setPermissionChoice] = useState<SharePermission>("view");
  const [confirmingRevokeId, setConfirmingRevokeId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ key: number; message: string; tone?: "info" | "success" } | null>(
    null,
  );
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toastIdRef = useRef(0);

  function showToast(message: string, tone?: "info" | "success") {
    toastIdRef.current += 1;
    setToast({ key: toastIdRef.current, message, tone });
  }

  function handleGenerate() {
    startTransition(async () => {
      const result = await createShareAction({ tripId, permission });
      if (result.error === "rate-limited") {
        showToast("You've shared a lot today — try again tomorrow");
        return;
      }
      if (result.error || !result.share) {
        showToast("Couldn't create a link — try again");
        return;
      }
      showToast("Link created", "success");
      router.refresh();
    });
  }

  async function handleCopyOrShare(token: string) {
    const url = `${window.location.origin}/s/${token}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "A dream trip on Wanderlost", url });
        return;
      } catch {
        return; // visitor cancelled the native share sheet — not an error
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied", "success");
    } catch {
      showToast("Couldn't copy — select and copy the link manually");
    }
  }

  function handleSetPermission(shareId: string, next: SharePermission) {
    startTransition(async () => {
      await setPermissionAction({ shareId, tripId, permission: next });
      router.refresh();
    });
  }

  function handleRevoke(shareId: string) {
    setConfirmingRevokeId(null);
    startTransition(async () => {
      const ok = await revokeShareAction({ shareId, tripId });
      showToast(ok ? "Link revoked" : "Couldn't revoke — try again");
      router.refresh();
    });
  }

  function handleSetCollaboratorRole(collaboratorId: string, role: CollaboratorRole) {
    startTransition(async () => {
      await setCollaboratorRoleAction({ collaboratorId, tripId, role });
      router.refresh();
    });
  }

  function handleRemoveCollaborator(collaboratorId: string) {
    startTransition(async () => {
      const ok = await removeCollaboratorAction({ collaboratorId, tripId });
      showToast(ok ? "Collaborator removed" : "Couldn't remove — try again");
      router.refresh();
    });
  }

  const activeShares = initialShares.filter((share) => !share.isRevoked);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="open-share-sheet"
        className="press-physical inline-flex min-h-11 items-center gap-s2 rounded-pill border border-line px-s5 font-semibold text-ink"
      >
        <IconShare size={18} />
        Share
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Share this dream" testId="share-sheet">
        <div className="flex flex-col gap-s5">
          <div className="flex flex-col gap-s3">
            <p className="text-sm text-ink-soft">
              Anyone with the link can view the itinerary. Turn on collaborative
              editing to let them add their own ideas too.
            </p>
            <div className="flex flex-wrap items-center gap-s3">
              <label className="flex items-center gap-s2 text-sm font-semibold">
                <input
                  type="radio"
                  name="share-permission"
                  checked={permission === "view"}
                  onChange={() => setPermissionChoice("view")}
                />
                View only
              </label>
              <label className="flex items-center gap-s2 text-sm font-semibold">
                <input
                  type="radio"
                  name="share-permission"
                  checked={permission === "edit"}
                  onChange={() => setPermissionChoice("edit")}
                />
                Can add ideas
              </label>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              data-testid="generate-share-link"
              className="press-physical inline-flex min-h-11 items-center justify-center self-start rounded-pill bg-ink px-s5 font-semibold text-paper2"
            >
              Generate link
            </button>
          </div>

          {activeShares.length > 0 ? (
            <div className="flex flex-col gap-s3">
              <h3 className="font-display text-base">Active links</h3>
              {activeShares.map((share) => (
                <div
                  key={share.id}
                  data-testid="share-link-row"
                  className="ticket-surface flex flex-col gap-s2 p-s3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-s2">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-soft">
                      /s/{share.token}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyOrShare(share.token)}
                      data-testid="copy-share-link"
                      className="press-physical min-h-11 rounded-pill border border-line px-s3 text-sm font-semibold text-ink"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-s2 text-sm text-ink-soft">
                    <span>
                      Created {new Date(share.createdAt).toLocaleDateString()} · {share.viewCount}{" "}
                      {share.viewCount === 1 ? "view" : "views"}
                    </span>
                    <select
                      aria-label="Link permission"
                      value={share.permission}
                      onChange={(event) =>
                        handleSetPermission(share.id, event.target.value as SharePermission)
                      }
                      className="min-h-11 rounded-card border border-line bg-paper2 px-s2 text-sm"
                    >
                      <option value="view">View only</option>
                      <option value="edit">Can add ideas</option>
                    </select>
                  </div>
                  {confirmingRevokeId === share.id ? (
                    <div className="flex flex-wrap items-center gap-s2">
                      <span className="text-sm text-ink-soft">Revoke this link?</span>
                      <button
                        type="button"
                        onClick={() => handleRevoke(share.id)}
                        className="min-h-11 rounded-pill bg-alert px-s3 text-sm font-semibold text-paper2"
                      >
                        Yes, revoke
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingRevokeId(null)}
                        className="min-h-11 rounded-pill px-s3 text-sm font-semibold text-ink-soft hover:bg-paper2"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingRevokeId(share.id)}
                      data-testid="revoke-share-link"
                      className="self-start text-sm font-semibold text-alert underline"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {initialCollaborators.length > 0 ? (
            <div className="flex flex-col gap-s3">
              <h3 className="font-display text-base">Collaborators</h3>
              {initialCollaborators.map((collaborator) => (
                <div
                  key={collaborator.id}
                  data-testid="collaborator-row"
                  className="flex flex-wrap items-center justify-between gap-s2 ticket-surface p-s3"
                >
                  <span className="font-semibold">{collaborator.displayName ?? "A collaborator"}</span>
                  <div className="flex items-center gap-s2">
                    <select
                      aria-label={`Role for ${collaborator.displayName ?? "collaborator"}`}
                      value={collaborator.role}
                      onChange={(event) =>
                        handleSetCollaboratorRole(
                          collaborator.id,
                          event.target.value as CollaboratorRole,
                        )
                      }
                      className="min-h-11 rounded-card border border-line bg-paper2 px-s2 text-sm"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoveCollaborator(collaborator.id)}
                      className="min-h-11 rounded-pill px-s3 text-sm font-semibold text-alert hover:bg-paper2"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Sheet>

      {toast ? <Toast key={toast.key} message={toast.message} tone={toast.tone} /> : null}
    </>
  );
}
