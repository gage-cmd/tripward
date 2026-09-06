import type { RecoveryPreview, RecoveryPreviewPath } from "../types.js";

export function isSelectableRecoveryPath(path: RecoveryPreviewPath): boolean {
  return (
    path.safe &&
    path.kind !== "uncertain" &&
    path.restore_action !== "keep" &&
    path.restore_action !== "manual_review"
  );
}

export function defaultSelectedRecoveryPaths(preview: RecoveryPreview): string[] {
  if (!preview.preexisting_work_intact || preview.one_click_disabled) return [];
  return preview.paths.filter(isSelectableRecoveryPath).map((item) => item.path);
}

export function allowedRecoveryPaths(preview: RecoveryPreview): string[] {
  return preview.paths.filter(isSelectableRecoveryPath).map((item) => item.path);
}

export function selectedSubsetOfSafe(preview: RecoveryPreview, selected: string[]): string[] {
  const allowed = new Set(allowedRecoveryPaths(preview));
  return selected.filter((path) => allowed.has(path));
}

export function composeRestoreConfirmCommand(
  preview: RecoveryPreview,
  selected: string[] = defaultSelectedRecoveryPaths(preview),
): string | null {
  if (!preview.preexisting_work_intact) return null;
  const paths = selectedSubsetOfSafe(preview, selected);
  if (paths.length === 0) return null;
  return `tripward restore --confirm --digest ${preview.preview_digest} --paths ${paths.join(",")} ${preview.run_id}`;
}

/** Selected apply commands must carry a non-empty `--paths a,b` flag. */
export function composedCommandPathsFlag(command: string | null): string | null {
  if (!command) return null;
  const match = command.match(/--paths\s+(\S+)/);
  return match?.[1] ?? null;
}

export function recoveryPathCounts(preview: RecoveryPreview): {
  total: number;
  selectable: number;
  uncertain: number;
  keep: number;
  review: number;
} {
  const selectable = preview.preexisting_work_intact
    ? preview.paths.filter(isSelectableRecoveryPath).length
    : 0;
  return {
    total: preview.paths.length,
    selectable,
    uncertain: preview.paths.filter((item) => item.kind === "uncertain" || !item.safe).length,
    keep: preview.paths.filter((item) => item.restore_action === "keep").length,
    review: preview.paths.filter((item) => item.restore_action === "manual_review" || !item.safe).length,
  };
}
