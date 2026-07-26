import type { CollaboratorView } from "@/lib/services/shares";

/*
 * Small overlapping initials-avatar row (WF §13: "Collaborator avatars
 * shown if the trip is shared"). Owner-only display — collaborator names
 * are never shown on the public /s/[token] page beyond "added by" chips.
 */
export function CollaboratorAvatars({
  collaborators,
}: {
  collaborators: CollaboratorView[];
}) {
  const visible = collaborators.slice(0, 5);
  const overflow = collaborators.length - visible.length;

  return (
    <div className="flex items-center" data-testid="collaborator-avatars">
      {visible.map((collaborator, index) => (
        <span
          key={collaborator.id}
          title={`${collaborator.displayName ?? "Collaborator"} (${collaborator.role})`}
          style={{ marginLeft: index === 0 ? 0 : "-8px", zIndex: visible.length - index }}
          className="flex size-8 items-center justify-center rounded-pill border-2 border-paper bg-horizon text-xs font-bold text-paper2 shadow-e1"
        >
          {initialsFor(collaborator.displayName)}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="ml-1 text-xs font-semibold text-ink-soft">+{overflow}</span>
      ) : null}
    </div>
  );
}

function initialsFor(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}
