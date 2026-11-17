/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  CaptureRequest,
  type CaptureResult,
  type Change,
  ChangeStatus,
  CompareRequest,
  DeleteFolderRequest,
  DiffTarget,
  FolderReference,
  PreviewRequest,
  ReadRequest,
  type ReadResult,
  RestoreRequest
} from "@noldova/checkpoints.protocol";
import "@noldova/context.core";

import type { ICheckpointsService } from "../../interfaces/i-checkpoints.service.js";
import { CheckpointRestore } from "../../models/checkpoint-restore.js";
import { ReplyEvidence } from "../../models/reply-evidence.js";
import type { WorkFolder } from "../../models/work-folder.js";
import { WorkingTreeChange } from "../../models/working-tree-change.js";
import { Resources } from "../../resources.js";
import { GitIgnores } from "./git-ignores.js";

export class ReplyCheckpoints {
  private readonly service: ICheckpointsService;
  private readonly ignores: GitIgnores = new GitIgnores();

  public constructor(service: ICheckpointsService) {
    this.service = service;
  }

  public async captureAsync(folder: WorkFolder, replyId: string, signal?: AbortSignal): Promise<CaptureResult> {
    return await this.service.captureAsync(new CaptureRequest(ReplyCheckpoints.referenceOf(folder), Resources.formatCheckpointLabel(replyId)), signal);
  }

  public async changesSinceAsync(workFolder: WorkFolder, checkpoint: string, isReported: (path: string) => boolean, signal?: AbortSignal): Promise<ReplyEvidence> {
    const folder = ReplyCheckpoints.referenceOf(workFolder);
    const compared = await this.service.compareAsync(new CompareRequest(folder, checkpoint, null), signal);
    if (!compared.outcome.isCompared)
      return ReplyEvidence.refused(compared.outcome.value);
    const unreported = compared.changes.map(t => [t, join(workFolder.path, ...t.path.split(Resources.checkpointPathSeparator))] as const)
      .filter(([, path]) => !isReported(path));
    const ignored = await this.ignores.ignoredAsync(workFolder.path, unreported.map(([change]) => change.path), signal);
    const shown = unreported.filter(([change]) => !ignored.has(change.path));
    const kept = shown.slice(0, Resources.maximumEvidenceFiles);
    let isComplete = kept.length === shown.length;
    let budget = Resources.maximumEvidenceDiffBytes;
    const changes: WorkingTreeChange[] = [];
    for (const [change, path] of kept) {
      const readable = change.status !== ChangeStatus.Unknown;
      const limit = Math.min(Resources.maximumDiffBytes, budget);
      const read = readable && limit > 0 ? await this.readAsync(folder, checkpoint, change, limit, signal) : null;
      budget -= read?.content.length ?? 0;
      const leftOut = readable && (Object.isNull(read) || (read.isCut && limit < Resources.maximumDiffBytes));
      isComplete &&= !leftOut;
      changes.push(new WorkingTreeChange(path, ReplyCheckpoints.kindOf(change), ReplyCheckpoints.diffOf(read)));
    }
    return ReplyEvidence.compared(changes, isComplete);
  }

  public async restoreAsync(workFolder: WorkFolder, checkpoint: string, files: readonly string[] | null): Promise<CheckpointRestore> {
    const folder = ReplyCheckpoints.referenceOf(workFolder);
    const previewed = await this.service.previewRestoreAsync(new PreviewRequest(folder, checkpoint, Object.isNull(files) ? null : ReplyCheckpoints.scopeOf(workFolder.path, files)));
    if (Object.isNull(previewed.plan))
      return CheckpointRestore.refused(Resources.formatRestoreRefusal(previewed.outcome.value));
    const restored = await this.service.restoreAsync(new RestoreRequest(folder, previewed.plan));
    return restored.outcome.isRestored ? CheckpointRestore.restored(previewed.plan.steps.length)
      : CheckpointRestore.refused(Resources.formatRestoreRefusal(restored.outcome.value));
  }

  public async deleteAsync(folder: WorkFolder): Promise<boolean> {
    const deleted = await this.service.deleteFolderAsync(new DeleteFolderRequest(ReplyCheckpoints.referenceOf(folder)));
    return deleted.outcome.value === Resources.checkpointsDeleted;
  }

  private async readAsync(folder: FolderReference, checkpoint: string, change: Change, limit: number, signal: AbortSignal | undefined): Promise<ReadResult> {
    return await this.service.readAsync(new ReadRequest(folder, checkpoint, change.path, new DiffTarget(null), limit), signal);
  }

  private static diffOf(read: ReadResult | null): string | null {
    if (Object.isNull(read) || !read.outcome.isRead || read.isCut)
      return null;
    return Buffer.from(read.content).toString(Resources.utf8Encoding).split(Resources.lineSeparator).slice(0, Resources.maximumDiffLines)
      .join(Resources.lineSeparator);
  }

  private static kindOf(change: Change): string {
    return change.status === ChangeStatus.Added ? Resources.addKind : change.status === ChangeStatus.Deleted ? Resources.deleteKind : Resources.updateKind;
  }

  private static scopeOf(root: string, files: readonly string[]): readonly string[] {
    const paths = files.map(t => relative(root, resolve(root, t)))
      .filter(t => t !== "" && t !== ".." && !t.startsWith(`..${sep}`) && !isAbsolute(t))
      .map(t => t.split(sep).join(Resources.checkpointPathSeparator))
      .filter(t => !t.includes(Resources.windowsPathSeparator));
    return [...new Set(paths)];
  }

  private static referenceOf(folder: WorkFolder): FolderReference {
    return new FolderReference(folder.id, folder.path);
  }
}
