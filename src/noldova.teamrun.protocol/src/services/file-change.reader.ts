/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import { DetailKind } from "../enums/detail-kind.js";
import { DiffLineKind } from "../enums/diff-line-kind.js";
import { DiffLine } from "../models/diff-line.js";
import { FileEdit } from "../models/file-edit.js";
import type { Message } from "../models/message.js";
import type { MessageDetail } from "../models/message-detail.js";
import { Resources } from "../resources.js";

export class FileChangeReader {
  public editsOf(message: Message): readonly FileEdit[] {
    return this.editsIn(message.details);
  }

  public editsIn(details: readonly MessageDetail[]): readonly FileEdit[] {
    const edits: FileEdit[] = [];
    const compared = new Map<FileEdit, boolean>();
    for (const detail of details) {
      if (!FileChangeReader.isJsonObject(detail.payload))
        continue;
      const changes = FileChangeReader.arrayOf(detail.payload[Resources.changesField]);
      if (detail.kind === DetailKind.FileChange && !Object.isNull(changes))
        edits.push(...FileChangeReader.readCodexChanges(changes, FileChangeReader.sendsContent(detail.payload),
          detail.payload[Resources.sourceField] === Resources.workingTreeSource ? compared : null));
      else
        edits.push(...FileChangeReader.readClaudeTool(detail.payload));
    }

    return FileChangeReader.merge(edits, compared);
  }

  private static readCodexChanges(changes: readonly JsonValue[], sendsContent: boolean, compared: Map<FileEdit, boolean> | null): FileEdit[] {
    const edits: FileEdit[] = [];
    for (const change of changes) {
      if (!FileChangeReader.isJsonObject(change))
        continue;
      const path = change[Resources.pathField];
      if (!Object.isString(path) || String.isNullOrWhitespace(path))
        continue;
      const kind = FileChangeReader.kindOf(change[Resources.kindField]);
      const diff = change[Resources.diffField];
      const edit = new FileEdit(path, kind, Object.isString(diff) ? FileChangeReader.changeLines(kind, diff, sendsContent) : []);
      compared?.set(edit, Object.isString(diff) && FileChangeReader.isWhole(diff));
      edits.push(edit);
    }

    return edits;
  }

  private static readClaudeTool(payload: JsonObject): FileEdit[] {
    const tool = payload[Resources.toolField];
    const input = payload[Resources.inputField];
    if (!Object.isString(tool) || !FileChangeReader.isJsonObject(input))
      return [];
    const path = input[tool === Resources.notebookEditTool ? Resources.notebookPathField : Resources.filePathField];
    if (!Object.isString(path) || String.isNullOrWhitespace(path))
      return [];
    switch (tool) {
      case Resources.notebookEditTool:
        return [new FileEdit(path, Resources.updateKind,
          input[Resources.editModeField] === Resources.deleteEditMode ? [] : FileChangeReader.replacementLines(undefined, input[Resources.newSourceField]))];
      case Resources.editTool:
        return [new FileEdit(path, Resources.updateKind, FileChangeReader.replacementLines(input[Resources.oldStringField], input[Resources.newStringField]))];
      case Resources.multiEditTool:
        return [new FileEdit(path, Resources.updateKind, FileChangeReader.multiEditLines(FileChangeReader.arrayOf(input[Resources.editsField])))];
      case Resources.writeTool:
        return [new FileEdit(path, Resources.addKind, FileChangeReader.replacementLines(undefined, input[Resources.contentField]))];
      default:
        return [];
    }
  }

  private static multiEditLines(edits: readonly JsonValue[] | null): DiffLine[] {
    if (Object.isNull(edits))
      return [];

    return edits.flatMap(t => FileChangeReader.isJsonObject(t) ? FileChangeReader.replacementLines(t[Resources.oldStringField], t[Resources.newStringField]) : []);
  }

  private static replacementLines(before: JsonValue | undefined, after: JsonValue | undefined): DiffLine[] {
    const removed = Object.isString(before) ? before.split(Resources.lineSeparator).map(t => new DiffLine(DiffLineKind.Removed, t)) : [];
    const added = Object.isString(after) ? after.split(Resources.lineSeparator).map(t => new DiffLine(DiffLineKind.Added, t)) : [];

    return [...removed, ...added];
  }

  private static parseUnifiedDiff(diff: string): DiffLine[] {
    return diff.split(Resources.lineSeparator).filter(t => t.length > 0).map(line => {
      if (line.startsWith(Resources.diffAddedFilePrefix) || line.startsWith(Resources.diffRemovedFilePrefix) || line.startsWith(Resources.diffHunkPrefix))
        return new DiffLine(DiffLineKind.Meta, line);
      if (line.startsWith(Resources.diffAddedPrefix))
        return new DiffLine(DiffLineKind.Added, line.slice(1));
      if (line.startsWith(Resources.diffRemovedPrefix))
        return new DiffLine(DiffLineKind.Removed, line.slice(1));
      return new DiffLine(DiffLineKind.Context, line.startsWith(Resources.diffContextPrefix) ? line.slice(1) : line);
    });
  }

  private static kindOf(kind: JsonValue | undefined): string {
    const value = Object.isString(kind) && kind.startsWith(Resources.jsonObjectStart) ? FileChangeReader.parse(kind) : kind;
    if (Object.isString(value))
      return value;
    if (!FileChangeReader.isJsonObject(value))
      return Resources.updateKind;
    const type = value[Resources.typeField];
    if (!Object.isString(type))
      return Resources.updateKind;
    return type === Resources.updateKind && Object.isString(value[Resources.movePathField]) ? Resources.moveKind : type;
  }

  private static sendsContent(payload: JsonObject): boolean {
    return Object.isUndefined(payload[Resources.toolField]) && Object.isUndefined(payload[Resources.sourceField]);
  }

  private static changeLines(kind: string, diff: string, sendsContent: boolean): DiffLine[] {
    const whole = !sendsContent ? null : kind === Resources.addKind ? DiffLineKind.Added : kind === Resources.deleteKind ? DiffLineKind.Removed : null;
    if (Object.isNull(whole))
      return FileChangeReader.parseUnifiedDiff(diff);
    if (diff.length === 0)
      return [];
    const content = diff.endsWith(Resources.lineSeparator) ? diff.slice(0, -Resources.lineSeparator.length) : diff;
    return content.split(Resources.lineSeparator).map(t => new DiffLine(whole, t));
  }

  private static isWhole(diff: string): boolean {
    return diff.endsWith(Resources.lineSeparator) || diff.split(Resources.lineSeparator).length < Resources.maximumDiffLines;
  }

  private static parse(text: string): JsonObject | null {
    try {
      return JsonReader.parse(text).toJson();
    }
    catch {
      return null;
    }
  }

  private static merge(edits: readonly FileEdit[], compared: ReadonlyMap<FileEdit, boolean>): readonly FileEdit[] {
    const merged = new Map<string, FileEdit>();
    const fromTree = new Set<string>();
    for (const edit of edits) {
      const key = FileChangeReader.keyOf(edit.path);
      const previous = merged.get(key);
      const replaces = compared.has(edit) && !fromTree.has(key);
      if (Object.isUndefined(previous) || (replaces && compared.get(edit) === true))
        merged.set(key, edit);
      else if (!replaces)
        merged.set(key, new FileEdit(previous.path, previous.kind, [...previous.lines, ...edit.lines]));
      if (merged.get(key) === edit && compared.has(edit))
        fromTree.add(key);
    }

    return [...merged.values()];
  }

  private static keyOf(path: string): string {
    const slashed = path.replaceAll(Resources.backslash, Resources.slash);
    return Resources.drivePathPattern.test(path) || path.includes(Resources.backslash) ? slashed.toLowerCase() : slashed;
  }

  private static isJsonObject(value: JsonValue | undefined): value is JsonObject {
    return Object.isObject(value) && !Array.isArray(value);
  }

  private static arrayOf(value: JsonValue | undefined): readonly JsonValue[] | null {
    return Array.isArray(value) ? value : null;
  }
}
