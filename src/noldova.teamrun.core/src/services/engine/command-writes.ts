/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep, win32 } from "node:path";

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { CommandTargets } from "../../models/command-targets.js";
import { DiffRun } from "../../models/diff-run.js";
import { FileSnapshot } from "../../models/file-snapshot.js";
import { ReplyEvidence } from "../../models/reply-evidence.js";
import { WorkingTreeChange } from "../../models/working-tree-change.js";
import { Resources } from "../../resources.js";

export class CommandWrites {
  private readonly root: string;
  private readonly rootKey: string;
  private readonly since: number;
  private readonly platform: string;
  private readonly tracked: Map<string, { readonly path: string; readonly before: FileSnapshot | null }> = new Map();
  private budget: number = Resources.maximumEvidenceDiffBytes;
  private isCut: boolean = false;

  public constructor(root: string, since: number, platform: string = process.platform) {
    this.root = root;
    this.rootKey = CommandWrites.folderKey(root);
    this.since = since;
    this.platform = platform;
  }

  public note(payload: JsonValue): void {
    for (const path of CommandWrites.targetsOf(payload, this.root, this.platform).files) {
      const key = CommandWrites.pathKey(path);
      if (this.tracked.has(key) || !CommandWrites.isOutside(this.rootKey, CommandWrites.folderKey(path)))
        continue;
      if (this.tracked.size >= Resources.maximumEvidenceFiles) {
        this.isCut = true;
        continue;
      }
      this.tracked.set(key, { path, before: this.read(path) });
    }
  }

  public changesSince(isReported: (path: string) => boolean): ReplyEvidence {
    const changes: WorkingTreeChange[] = [];
    let isComplete = !this.isCut;
    for (const { path, before } of this.tracked.values()) {
      if (isReported(path))
        continue;
      const after = this.read(path);
      if (Object.isNull(after)) {
        isComplete = false;
        continue;
      }
      const change = this.changeOf(path, before, after);
      if (!Object.isNull(change))
        changes.push(change);
    }

    return ReplyEvidence.compared(changes, isComplete);
  }

  public static targetsOf(payload: JsonValue, root: string, platform: string = process.platform): CommandTargets {
    if (!CommandWrites.isJsonObject(payload))
      return new CommandTargets([], []);
    const cwd = payload[Resources.cwdField];
    const folder = Object.isString(cwd) ? resolve(root, cwd) : root;
    const writes = payload[ProtocolResources.writesField];
    const unnamed = payload[ProtocolResources.unnamedWritesField];
    if (!Array.isArray(writes) || !Array.isArray(unnamed))
      return new CommandTargets([], [folder]);

    const files: string[] = [];
    const unnamedIn: string[] = [];
    for (const write of writes) {
      if (!Object.isString(write))
        unnamedIn.push(folder);
      else if (CommandWrites.isRootedWithoutDrive(write, platform))
        unnamedIn.push(win32.dirname(write));
      else
        files.push(CommandWrites.resolveIn(folder, write));
    }
    for (const entry of unnamed)
      unnamedIn.push(!Object.isString(entry) ? folder : CommandWrites.isRootedWithoutDrive(entry, platform) ? entry : CommandWrites.resolveIn(folder, entry));

    return new CommandTargets(files, unnamedIn);
  }

  public static folderKey(path: string): string {
    let existing = path;
    while (!existsSync(existing) && dirname(existing) !== existing)
      existing = dirname(existing);
    return join(realpathSync.native(existing), relative(existing, path));
  }

  public static isOutside(root: string, path: string): boolean {
    const child = relative(root, path);
    return isAbsolute(child) || child === Resources.parentDirectory || child.startsWith(Resources.parentDirectory + sep);
  }

  public static pathKey(path: string): string {
    const absolute = resolve(path);
    const directory = dirname(absolute);
    const parent = existsSync(directory) ? realpathSync.native(directory) : directory;
    return join(parent, basename(absolute)).toLowerCase();
  }

  private changeOf(path: string, before: FileSnapshot | null, after: FileSnapshot): WorkingTreeChange | null {
    if ((!Object.isNull(before) && before.exists && !before.isFile) || (after.exists && !after.isFile))
      return null;
    if (Object.isNull(before) || before.isSameAs(after))
      return after.exists && after.modified >= this.since ? new WorkingTreeChange(path, Resources.updateKind, null) : null;
    if (before.exists && after.exists && !Object.isNull(before.text) && before.text === after.text)
      return null;
    const kind = !before.exists ? Resources.addKind : !after.exists ? Resources.deleteKind : Resources.updateKind;
    const old = before.exists ? before.text : String.empty;
    const next = after.exists ? after.text : String.empty;
    const diff = Object.isNull(old) || Object.isNull(next) ? null
      : CommandWrites.diffOf(before.exists ? path : null, after.exists ? path : null, CommandWrites.linesOf(old), CommandWrites.linesOf(next));
    return new WorkingTreeChange(path, kind, diff);
  }

  private read(path: string): FileSnapshot | null {
    try {
      const stat = statSync(path, { throwIfNoEntry: false });
      if (Object.isUndefined(stat))
        return FileSnapshot.missing;
      if (!stat.isFile())
        return new FileSnapshot(true, false, 0, stat.mtimeMs, null);
      if (stat.size > Math.min(Resources.maximumDiffBytes, this.budget))
        return new FileSnapshot(true, true, stat.size, stat.mtimeMs, null);
      const content = readFileSync(path);
      this.budget -= content.length;
      return new FileSnapshot(true, true, stat.size, stat.mtimeMs, content.includes(0) ? null : content.toString(Resources.utf8Encoding));
    }
    catch {
      return null;
    }
  }

  private static diffOf(from: string | null, to: string | null, old: readonly string[], next: readonly string[]): string {
    let start = 0;
    while (start < old.length && start < next.length && old[start] === next[start])
      start += 1;
    let end = 0;
    while (end < old.length - start && end < next.length - start && old[old.length - 1 - end] === next[next.length - 1 - end])
      end += 1;
    const hunks: DiffRun[][] = [];
    for (const run of CommandWrites.runsOf(old, next, start, old.length - end, next.length - end)) {
      const hunk = hunks.at(-1);
      const last = hunk?.at(-1);
      if (Object.isUndefined(hunk) || Object.isUndefined(last) || run.oldAt - last.oldAt - last.removed > 2 * Resources.diffContextLines)
        hunks.push([run]);
      else
        hunk.push(run);
    }
    return [Resources.formatDiffFiles(from, to), ...hunks.flatMap(t => CommandWrites.hunkOf(old, next, t))]
      .slice(0, Resources.maximumDiffLines).join(Resources.lineSeparator);
  }

  private static runsOf(old: readonly string[], next: readonly string[], start: number, oldEnd: number, newEnd: number): readonly DiffRun[] {
    const isSmall = (oldEnd - start + 1) * (newEnd - start + 1) <= Resources.maximumDiffCells;
    const runs = isSmall ? CommandWrites.commonRunsOf(old, next, start, oldEnd, newEnd)
      : old.length === next.length ? CommandWrites.pairedRunsOf(old, next, start, oldEnd) : [];
    return runs.length > 0 ? runs : [new DiffRun(start, start, oldEnd - start, newEnd - start)];
  }

  private static commonRunsOf(old: readonly string[], next: readonly string[], start: number, oldEnd: number, newEnd: number): readonly DiffRun[] {
    const rows = oldEnd - start;
    const columns = newEnd - start;
    const common = new Uint32Array((rows + 1) * (columns + 1));
    const commonAt = (row: number, column: number): number => common[row * (columns + 1) + column] as number;
    const matches = (row: number, column: number): boolean => row < rows && column < columns && old[start + row] === next[start + column];
    for (let row = rows - 1; row >= 0; row--)
      for (let column = columns - 1; column >= 0; column--)
        common[row * (columns + 1) + column] = matches(row, column) ? commonAt(row + 1, column + 1) + 1
          : Math.max(commonAt(row + 1, column), commonAt(row, column + 1));
    const runs: DiffRun[] = [];
    let row = 0;
    let column = 0;
    while (row < rows || column < columns) {
      if (matches(row, column)) {
        row += 1;
        column += 1;
        continue;
      }
      const oldAt = row;
      const newAt = column;
      while ((row < rows || column < columns) && !matches(row, column)) {
        if (column < columns && (row === rows || commonAt(row, column + 1) >= commonAt(row + 1, column)))
          column += 1;
        else
          row += 1;
      }
      runs.push(new DiffRun(start + oldAt, start + newAt, row - oldAt, column - newAt));
    }
    return runs;
  }

  private static pairedRunsOf(old: readonly string[], next: readonly string[], start: number, end: number): readonly DiffRun[] {
    const runs: DiffRun[] = [];
    let index = start;
    while (index < end) {
      if (old[index] === next[index]) {
        index += 1;
        continue;
      }
      const at = index;
      while (index < end && old[index] !== next[index])
        index += 1;
      runs.push(new DiffRun(at, at, index - at, index - at));
    }
    return runs;
  }

  private static hunkOf(old: readonly string[], next: readonly string[], runs: readonly DiffRun[]): readonly string[] {
    const head = runs[0] as DiffRun;
    const first = Math.max(0, head.oldAt - Resources.diffContextLines);
    const lines: string[] = [];
    let index = first;
    let removed = 0;
    let added = 0;
    for (const run of runs) {
      lines.push(...old.slice(index, run.oldAt).map(t => `${Resources.diffContextPrefix}${t}`),
        ...old.slice(run.oldAt, run.oldAt + run.removed).map(t => `${Resources.diffRemovedPrefix}${t}`),
        ...next.slice(run.newAt, run.newAt + run.added).map(t => `${Resources.diffAddedPrefix}${t}`));
      index = run.oldAt + run.removed;
      removed += run.removed;
      added += run.added;
    }
    const tail = old.slice(index, index + Resources.diffContextLines);
    const kept = index + tail.length - first - removed;
    return [Resources.formatDiffHunk(first, kept + removed, head.newAt - head.oldAt + first, kept + added), ...lines,
      ...tail.map(t => `${Resources.diffContextPrefix}${t}`)];
  }

  private static linesOf(text: string): readonly string[] {
    if (text.length === 0)
      return [];
    const lines = text.split(Resources.lineSeparator).map(t => t.replace(Resources.trailingCarriageReturnPattern, String.empty));
    return text.endsWith(Resources.lineSeparator) ? lines.slice(0, -1) : lines;
  }

  private static resolveIn(folder: string, target: string): string {
    if (target === Resources.homeFolder || Resources.homeTargetPattern.test(target))
      return join(homedir(), target.slice(Resources.homeFolder.length));
    return resolve(folder, target);
  }

  private static isRootedWithoutDrive(target: string, platform: string): boolean {
    return platform === Resources.windowsPlatform && Resources.rootedWithoutDrivePattern.test(target);
  }

  private static isJsonObject(value: JsonValue | undefined): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
