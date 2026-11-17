/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import {
  CaptureMode,
  CaptureOutcome,
  type CaptureRequest,
  CaptureResult,
  Change,
  ChangeSide,
  ChangeStatus,
  Checkpoint,
  CompareOutcome,
  type CompareRequest,
  CompareResult,
  DeleteFolderOutcome,
  type DeleteFolderRequest,
  DeleteFolderResult,
  PathKind,
  PreviewOutcome,
  type PreviewRequest,
  PreviewResult,
  ReadOutcome,
  type ReadRequest,
  ReadResult,
  RestoreAction,
  RestoreOutcome,
  RestorePlan,
  type RestoreRequest,
  RestoreResult,
  RestoreStep,
  UnreadReason
} from "@noldova/checkpoints.protocol";
import type { ICheckpointsService } from "@noldova/teamrun.core";

import { ChangeSignal } from "./change-signal.fixture.js";

export class FakeCheckpoints implements ICheckpointsService {
  private static readonly REPOSITORY_FOLDER: string = ".git";
  private static readonly STATE: string = "0".repeat(64);

  public readonly captures: CaptureRequest[] = [];
  public readonly compares: CompareRequest[] = [];
  public readonly reads: ReadRequest[] = [];
  public readonly previews: PreviewRequest[] = [];
  public readonly restores: RestoreRequest[] = [];
  public readonly deletes: DeleteFolderRequest[] = [];
  public deleteError: Error | null = null;
  public deleteOutcome: DeleteFolderOutcome = DeleteFolderOutcome.Deleted;
  public captureError: Error | null = null;
  public compareError: Error | null = null;
  public previewError: Error | null = null;
  public restoreError: Error | null = null;
  public captureOutcome: CaptureOutcome | null = null;
  public compareOutcome: CompareOutcome | null = null;
  public holds: "capture" | "compare" | null = null;
  public readonly signals: (AbortSignal | undefined)[] = [];
  public readBytes: number = 0;
  public previewOutcome: PreviewOutcome | null = null;
  public restoreOutcome: RestoreOutcome | null = null;
  public readonly statuses: Map<string, ChangeStatus> = new Map();
  private readonly checkpoints: Map<string, Map<string, Buffer>> = new Map();
  private taken: number = 0;

  public captureAsync(request: CaptureRequest, signal?: AbortSignal): Promise<CaptureResult> {
    this.captures.push(request);
    this.signals.push(signal);
    ChangeSignal.notify();
    if (signal?.aborted === true)
      return Promise.reject(signal.reason as Error);
    if (this.holds === "capture")
      return FakeCheckpoints.holdAsync(signal);
    if (!Object.isNull(this.captureError))
      return Promise.reject(this.captureError);
    if (!Object.isNull(this.captureOutcome))
      return Promise.resolve(new CaptureResult(this.captureOutcome, null, null, null));
    if (!existsSync(request.folder.path))
      return Promise.resolve(new CaptureResult(CaptureOutcome.FolderMissing, null, null, null));
    const checkpoint = this.take(request.label);
    this.checkpoints.set(checkpoint.id, FakeCheckpoints.filesOf(request.folder.path));
    return Promise.resolve(new CaptureResult(CaptureOutcome.Captured, checkpoint, null, null));
  }

  public compareAsync(request: CompareRequest, signal?: AbortSignal): Promise<CompareResult> {
    this.compares.push(request);
    this.signals.push(signal);
    ChangeSignal.notify();
    if (signal?.aborted === true)
      return Promise.reject(signal.reason as Error);
    if (!Object.isNull(this.compareError))
      return Promise.reject(this.compareError);
    if (this.holds === "compare")
      return FakeCheckpoints.holdAsync(signal);
    if (!Object.isNull(this.compareOutcome))
      return Promise.resolve(new CompareResult(this.compareOutcome, []));
    const before = this.checkpoints.get(request.from);
    if (!existsSync(request.folder.path))
      return Promise.resolve(new CompareResult(CompareOutcome.FolderMissing, []));
    if (Object.isUndefined(before))
      return Promise.resolve(new CompareResult(CompareOutcome.CheckpointMissing, []));
    const changes = FakeCheckpoints.changesOf(before, FakeCheckpoints.filesOf(request.folder.path)).map(([path, status]) => {
      const given = this.statuses.get(path) ?? status;
      if (given === ChangeStatus.Unknown)
        return new Change(path, given, null, null, UnreadReason.Denied);
      return new Change(path, given, given === ChangeStatus.Added ? null : FakeCheckpoints.side(before.get(path)),
        given === ChangeStatus.Deleted ? null : FakeCheckpoints.side(readFileSync(join(request.folder.path, path))), null);
    });
    return Promise.resolve(new CompareResult(CompareOutcome.Compared, changes));
  }

  public readAsync(request: ReadRequest, signal?: AbortSignal): Promise<ReadResult> {
    this.reads.push(request);
    this.signals.push(signal);
    ChangeSignal.notify();
    if (signal?.aborted === true)
      return Promise.reject(signal.reason as Error);
    const before = this.checkpoints.get(request.checkpoint)?.get(request.path) ?? null;
    const location = join(request.folder.path, request.path);
    const after = existsSync(location) ? readFileSync(location) : null;
    if (Object.isNull(before) && Object.isNull(after))
      return Promise.resolve(new ReadResult(ReadOutcome.PathMissing, new Uint8Array(), 0));
    if ([before, after].some(t => !Object.isNull(t) && t.includes(0)))
      return Promise.resolve(new ReadResult(ReadOutcome.Binary, new Uint8Array(), 0));
    const lines = (side: Buffer | null): string[] => Object.isNull(side) || side.length === 0 ? [] : side.toString("utf8").replace(/\n$/u, "").split("\n");
    const removed = lines(before);
    const added = lines(after);
    const diff = Buffer.from([`--- a/${request.path}`, `+++ b/${request.path}`, `@@ -1,${removed.length} +1,${added.length} @@`,
      ...removed.map(t => `-${t}`), ...added.map(t => `+${t}`)].join("\n") + "\n");
    const content = diff.subarray(0, request.limit);
    this.readBytes += content.length;
    return Promise.resolve(new ReadResult(ReadOutcome.Read, content, diff.length));
  }

  public previewRestoreAsync(request: PreviewRequest): Promise<PreviewResult> {
    this.previews.push(request);
    ChangeSignal.notify();
    if (!Object.isNull(this.previewError))
      return Promise.reject(this.previewError);
    if (!Object.isNull(this.previewOutcome))
      return Promise.resolve(new PreviewResult(this.previewOutcome, null));
    const files = this.checkpoints.get(request.checkpoint);
    if (!existsSync(request.folder.path))
      return Promise.resolve(new PreviewResult(PreviewOutcome.FolderMissing, null));
    if (Object.isUndefined(files))
      return Promise.resolve(new PreviewResult(PreviewOutcome.CheckpointMissing, null));
    const now = FakeCheckpoints.filesOf(request.folder.path);
    const scope = request.paths;
    const inScope = (path: string): boolean => Object.isNull(scope) || scope.some(t => path === t || path.startsWith(`${t}/`));
    const steps = FakeCheckpoints.changesOf(files, now).filter(([path]) => inScope(path)).map(([path, status]) => status === ChangeStatus.Added
      ? new RestoreStep(path, RestoreAction.Delete, FakeCheckpoints.side(now.get(path)), null)
      : status === ChangeStatus.Deleted ? new RestoreStep(path, RestoreAction.Write, null, FakeCheckpoints.side(files.get(path)))
        : new RestoreStep(path, RestoreAction.Replace, FakeCheckpoints.side(now.get(path)), FakeCheckpoints.side(files.get(path))));
    return Promise.resolve(new PreviewResult(PreviewOutcome.Planned, new RestorePlan(request.checkpoint, steps, [], 0, 0, FakeCheckpoints.STATE, scope)));
  }

  public restoreAsync(request: RestoreRequest): Promise<RestoreResult> {
    this.restores.push(request);
    ChangeSignal.notify();
    if (!Object.isNull(this.restoreError))
      return Promise.reject(this.restoreError);
    if (!Object.isNull(this.restoreOutcome))
      return Promise.resolve(new RestoreResult(this.restoreOutcome, [RestoreOutcome.Restored, RestoreOutcome.RolledBack].includes(this.restoreOutcome) ? this.before() : null, null));
    const files = this.checkpoints.get(request.plan.checkpoint)!;
    for (const step of request.plan.steps) {
      const location = join(request.folder.path, step.path);
      if (step.action === RestoreAction.Delete)
        rmSync(location);
      else {
        mkdirSync(dirname(location), { recursive: true });
        writeFileSync(location, files.get(step.path)!);
      }
    }
    return Promise.resolve(new RestoreResult(RestoreOutcome.Restored, this.before(), null));
  }

  public deleteFolderAsync(request: DeleteFolderRequest): Promise<DeleteFolderResult> {
    this.deletes.push(request);
    ChangeSignal.notify();
    if (!Object.isNull(this.deleteError))
      return Promise.reject(this.deleteError);
    return Promise.resolve(new DeleteFolderResult(this.deleteOutcome));
  }

  private take(label: string | null): Checkpoint {
    this.taken++;
    return new Checkpoint(`00000000-0000-7000-8000-${String(this.taken).padStart(12, "0")}`, new Date(), CaptureMode.EveryFile, label, []);
  }

  private before(): Checkpoint {
    return this.take(null);
  }

  private static holdAsync<T>(signal: AbortSignal | undefined): Promise<T> {
    return new Promise((_, reject) => signal?.addEventListener("abort", () => reject(signal.reason as Error), { once: true }));
  }

  private static filesOf(folder: string): Map<string, Buffer> {
    const files = new Map<string, Buffer>();
    if (!existsSync(folder))
      return files;
    const walk = (current: string): void => {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const location = join(current, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== FakeCheckpoints.REPOSITORY_FOLDER)
            walk(location);
        }
        else if (entry.isFile())
          files.set(relative(folder, location).split(/[\\/]/u).join("/"), readFileSync(location));
      }
    };
    walk(folder);
    return files;
  }

  private static changesOf(before: Map<string, Buffer>, after: Map<string, Buffer>): [string, ChangeStatus][] {
    const changes: [string, ChangeStatus][] = [];
    for (const [path, content] of before) {
      const now = after.get(path);
      if (Object.isUndefined(now))
        changes.push([path, ChangeStatus.Deleted]);
      else if (!now.equals(content))
        changes.push([path, ChangeStatus.Modified]);
    }
    for (const path of after.keys())
      if (!before.has(path))
        changes.push([path, ChangeStatus.Added]);
    return changes.sort(([a], [b]) => a.localeCompare(b));
  }

  private static side(content: Buffer | undefined): ChangeSide {
    return new ChangeSide(PathKind.File, content?.length ?? 0, !(content?.includes(0) ?? false));
  }
}
