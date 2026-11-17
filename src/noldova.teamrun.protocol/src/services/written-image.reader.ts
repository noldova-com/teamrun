/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import type { Message } from "../models/message.js";
import type { MessageDetail } from "../models/message-detail.js";
import { Resources } from "../resources.js";
import { FileChangeReader } from "./file-change.reader.js";

export class WrittenImageReader {
  public pathsOf(message: Message, rootPath: string): readonly string[] {
    const root = WrittenImageReader.rootOf(rootPath);
    const edits = new FileChangeReader().editsOf(message);
    const generated = message.details.flatMap(t => [Resources.savedPathField, Resources.storedPathField].map(u => WrittenImageReader.pathFieldOf(t, u)));
    const excluded = new Set([...generated.map(t => Object.isNull(t) ? null : WrittenImageReader.normalize(t, rootPath)),
      ...edits.filter(t => t.kind === Resources.deleteKind).map(t => WrittenImageReader.normalize(t.path, rootPath)),
      ...this.markdownImagePathsOf(message, rootPath).map(t => WrittenImageReader.normalize(t, rootPath))]);
    const found = new Map<string, string>();
    const consider = (path: string): void => {
      const key = WrittenImageReader.normalize(path, rootPath);
      if (WrittenImageReader.isUnder(key, root) && !excluded.has(key) && !found.has(key))
        found.set(key, path);
    };
    for (const edit of edits)
      if (Resources.writtenImagePathPattern.test(edit.path))
        consider(edit.path);
    const reads = message.details.filter(t => WrittenImageReader.isReadingStep(t));
    const readIds = new Set(reads.map(t => WrittenImageReader.toolUseIdOf(t)).filter(t => !Object.isNull(t)));
    const isRead = (detail: MessageDetail): boolean => {
      const id = WrittenImageReader.toolUseIdOf(detail);
      return reads.includes(detail) || (!Object.isNull(id) && readIds.has(id));
    };
    for (const detail of message.details.filter(t => !isRead(t)))
      for (const text of [detail.text, ...WrittenImageReader.stringsOf(detail.payload)])
        for (const path of WrittenImageReader.pathsIn(text))
          consider(path);

    return [...found.values()];
  }

  public markdownImagePathsOf(message: Message, rootPath: string): readonly string[] {
    return this.markdownImageSourcesOf(message).map(t => this.markdownImagePathOf(t, rootPath))
      .filter((t, i, all): t is string => !Object.isNull(t) && all.indexOf(t) === i);
  }

  public markdownImageSourcesOf(message: Message): readonly string[] {
    return WrittenImageReader.addressesOf(message, Resources.markdownImageSearches).map(t => t.trim()).filter((t, i, all) => all.indexOf(t) === i);
  }

  public markdownImagePathOf(source: string, rootPath: string): string | null {
    const path = WrittenImageReader.decode(source.trim());
    return Resources.writtenImagePathPattern.test(path) ? WrittenImageReader.projectPathOf(path, rootPath) : null;
  }

  public markdownLinkImagePathsOf(message: Message, rootPath: string): readonly string[] {
    return WrittenImageReader.addressesOf(message, Resources.markdownLinkSearches).map(t => this.linkedPathOf(WrittenImageReader.decode(t.trim()), rootPath))
      .filter((t, i, all): t is string => !Object.isNull(t) && Resources.writtenImagePathPattern.test(t) && all.indexOf(t) === i);
  }

  public linkedPathOf(target: string, rootPath: string): string | null {
    return WrittenImageReader.projectPathOf(WrittenImageReader.linkPathOf(target), rootPath);
  }

  public localPathOf(target: string): string | null {
    const path = WrittenImageReader.linkPathOf(target);
    return Resources.absolutePathPattern.test(path) && !Resources.networkPathPattern.test(path) && !Resources.controlCharacterPattern.test(path) ? path : null;
  }

  public generatedPathOf(detail: MessageDetail, rootPath: string): string | null {
    const path = WrittenImageReader.pathFieldOf(detail, Resources.savedPathField);
    return !Object.isNull(path) && Resources.writtenImagePathPattern.test(path)
      && WrittenImageReader.isUnder(WrittenImageReader.normalize(path, rootPath), WrittenImageReader.rootOf(rootPath)) ? path : null;
  }

  public storedPathOf(detail: MessageDetail): string | null {
    const path = WrittenImageReader.pathFieldOf(detail, Resources.storedPathField);
    return !Object.isNull(path) && Resources.writtenImagePathPattern.test(path) ? path : null;
  }

  private static pathFieldOf(detail: MessageDetail, field: string): string | null {
    const payload = detail.payload;
    if (!WrittenImageReader.isJsonObject(payload) || payload[Resources.itemTypeField] !== Resources.imageGenerationItemType)
      return null;
    const path = payload[field];
    return Object.isString(path) ? path : null;
  }

  private static isReadingStep(detail: MessageDetail): boolean {
    const payload = detail.payload;
    if (!WrittenImageReader.isJsonObject(payload))
      return false;
    const tool = payload[Resources.toolField];
    const kinds = Object.isString(payload[Resources.acpToolCallIdField]) ? Resources.acpReadingKinds : Resources.readingTools;
    return payload[Resources.readOnlyField] === true || (Object.isString(tool) && kinds.includes(tool));
  }

  private static toolUseIdOf(detail: MessageDetail): string | null {
    const payload = detail.payload;
    const id = WrittenImageReader.isJsonObject(payload) ? payload[Resources.toolUseIdField] : null;
    return Object.isString(id) ? id : null;
  }

  private static isUnder(key: string, root: string): boolean {
    return key.startsWith(root) && !Resources.parentSegmentPattern.test(key);
  }

  private static rootOf(rootPath: string): string {
    return `${WrittenImageReader.normalize(rootPath, rootPath).replace(Resources.trailingSlashesPattern, String.empty)}${Resources.slash}`;
  }

  private static pathsIn(text: string): string[] {
    return text.split(Resources.pathBreakPattern).flatMap(run => {
      const last = [...run.matchAll(Resources.imageExtensionSearch)].at(-1);
      return Object.isUndefined(last) ? [] : [...run.slice(0, last.index + last[0].length).matchAll(Resources.writtenImagePathSearch)].map(t => t[0]);
    });
  }

  private static stringsOf(value: JsonValue): string[] {
    if (Object.isString(value))
      return [value];
    if (Array.isArray(value))
      return value.flatMap(t => WrittenImageReader.stringsOf(t));
    if (!WrittenImageReader.isJsonObject(value))
      return [];
    return Object.entries(value).filter(([key]) => key !== Resources.imageDataField).flatMap(([, t]) => WrittenImageReader.stringsOf(t));
  }

  private static addressesOf(message: Message, searches: readonly RegExp[]): string[] {
    return message.details.flatMap(t => {
      const text = WrittenImageReader.proseOf(t.text).replace(Resources.markdownCodeSpanPattern, Resources.codeSpanReplacement);
      return searches.flatMap(u => [...text.matchAll(u)].map(v => (v[1] ?? v[2]!).replace(Resources.markdownEscapePattern, "$1")));
    });
  }

  private static proseOf(text: string): string {
    const kept: string[] = [];
    const items: number[] = [];
    let fence: string | null = null;
    let blockStart = true;
    let inCode = false;
    for (const line of text.split(Resources.lineSeparator)) {
      const indent = WrittenImageReader.indentOf(line);
      if (!Object.isNull(fence)) {
        if (line.trimStart().startsWith(fence) && indent < (items.at(-1) ?? 0) + Resources.markdownCodeIndent) {
          fence = null;
          blockStart = true;
        }
        kept.push(String.empty);
        continue;
      }
      if (String.isNullOrWhitespace(line)) {
        kept.push(line);
        blockStart = true;
        continue;
      }
      const item = Resources.markdownListItemPattern.exec(line);
      if (blockStart || !Object.isNull(item))
        WrittenImageReader.closeItems(items, indent);
      const listIndent = items.at(-1) ?? 0;
      const opening = Resources.markdownFenceOpenPattern.exec(line);
      if (!Object.isNull(opening) && indent < listIndent + Resources.markdownCodeIndent) {
        fence = opening[1]!;
        kept.push(String.empty);
        inCode = false;
        continue;
      }
      if ((blockStart || inCode) && indent >= listIndent + Resources.markdownCodeIndent) {
        kept.push(String.empty);
        blockStart = false;
        inCode = true;
        continue;
      }
      if (!Object.isNull(item))
        items.push(WrittenImageReader.indentOf(item[0]) + item[0].trimStart().length);
      kept.push(line);
      blockStart = indent < listIndent + Resources.markdownCodeIndent && Resources.markdownHeadingPattern.test(line);
      inCode = false;
    }
    return kept.join(Resources.lineSeparator);
  }

  private static closeItems(items: number[], indent: number): void {
    while (items.length > 0 && items.at(-1)! > indent)
      items.pop();
  }

  private static indentOf(line: string): number {
    let columns = 0;
    for (const character of line) {
      if (character === Resources.markdownSpace)
        columns += 1;
      else if (character === Resources.markdownTab)
        columns += Resources.markdownTabWidth - columns % Resources.markdownTabWidth;
      else
        break;
    }
    return columns;
  }

  private static projectPathOf(path: string, rootPath: string): string | null {
    if (String.isNullOrWhitespace(path) || Resources.controlCharacterPattern.test(path) || Resources.networkPathPattern.test(path)
      || (Resources.uriSchemePattern.test(path) && !Resources.drivePathPattern.test(path)))
      return null;
    const separator = rootPath.includes(Resources.backslash) ? Resources.backslash : Resources.slash;
    const full = Resources.absolutePathPattern.test(path) ? path
      : `${rootPath.replace(Resources.trailingSeparatorsPattern, String.empty)}${separator}${path.replace(Resources.leadingCurrentSegmentsPattern, String.empty)}`;
    const key = WrittenImageReader.normalize(full, rootPath).replace(Resources.currentSegmentsPattern, Resources.slash);
    return WrittenImageReader.isUnder(key, WrittenImageReader.rootOf(rootPath)) ? full : null;
  }

  private static linkPathOf(target: string): string {
    return target.replace(Resources.lineSuffixPattern, String.empty).replace(Resources.slashBeforeDrivePattern, String.empty);
  }

  private static decode(path: string): string {
    try {
      return decodeURIComponent(path);
    }
    catch {
      return path;
    }
  }

  private static normalize(path: string, rootPath: string): string {
    const slashed = path.replaceAll(Resources.backslash, Resources.slash);
    return Resources.drivePathPattern.test(rootPath) || rootPath.includes(Resources.backslash) ? slashed.toLowerCase() : slashed;
  }

  private static isJsonObject(value: JsonValue): value is JsonObject {
    return Object.isObject(value) && !Array.isArray(value);
  }
}
