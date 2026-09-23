/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import { FileChangeReader, type Message, type MessageDetail } from "@noldova/teamrun-protocol";

import { FileEdit } from "../models/file-edit";
import { ImageSource } from "../models/image-source";
import { Resources } from "../resources";

@Injectable({ providedIn: "root" })
export class ChangeReader {
  public editsOf(message: Message): readonly FileEdit[] {
    return new FileChangeReader().editsOf(message);
  }

  public imageFilesOf(message: Message, rootPath: string | null): readonly ImageSource[] {
    const found = new Map<string, ImageSource>();
    if (Object.isNull(rootPath) || String.isNullOrWhitespace(rootPath))
      return [];
    const generated = new Set(message.details.map(t => this.imageOf(t)?.path ?? null).filter(t => !Object.isNull(t)));
    const root = ChangeReader.normalize(rootPath);
    const consider = (candidate: string): void => {
      if (ChangeReader.normalize(candidate).startsWith(root) && !generated.has(candidate) && !found.has(candidate))
        found.set(candidate, new ImageSource(candidate, ChangeReader.fileNameOf(candidate), candidate, null));
    };
    for (const edit of this.editsOf(message))
      if (Resources.imagePathPattern.test(edit.path))
        consider(edit.path);
    for (const detail of message.details)
      for (const match of ChangeReader.textOf(detail).matchAll(Resources.imagePathSearch))
        consider(match[0]);

    return [...found.values()];
  }

  public imageOf(detail: MessageDetail): ImageSource | null {
    const payload = detail.payload;
    if (!ChangeReader.isJsonObject(payload) || payload[Resources.itemTypeField] !== Resources.imageGenerationItemType)
      return null;
    const savedPath = ChangeReader.pathOf(payload[Resources.savedPathField]);
    const storedPath = ChangeReader.pathOf(payload[Resources.storedPathField]);
    const data = payload[Resources.imageDataField];
    const mediaType = payload[Resources.mediaTypeField];
    const path = storedPath ?? savedPath;
    const url = Object.isString(data) && Object.isString(mediaType) ? `${Resources.dataUrlPrefix}${mediaType}${Resources.base64Marker}${data}` : null;
    if (Object.isNull(path) && Object.isNull(url))
      return null;
    const named = savedPath ?? path;

    return new ImageSource(path ?? String(detail.sequence), Object.isNull(named) ? Resources.generatedImageLabel : ChangeReader.fileNameOf(named), path, url);
  }

  private static pathOf(value: JsonValue | undefined): string | null {
    return Object.isString(value) && !String.isNullOrWhitespace(value) ? value : null;
  }

  private static fileNameOf(path: string): string {
    return path.slice(Math.max(path.lastIndexOf(Resources.slash), path.lastIndexOf(Resources.backslash)) + 1);
  }

  private static textOf(detail: MessageDetail): string {
    const payload = detail.payload;
    const searched = ChangeReader.isJsonObject(payload) && Resources.imageDataField in payload ? { ...payload, [Resources.imageDataField]: null } : payload;
    return `${detail.text}${Resources.lineSeparator}${JSON.stringify(searched)}`;
  }

  private static normalize(path: string): string {
    return path.replaceAll(Resources.backslash, Resources.slash).toLowerCase();
  }

  private static isJsonObject(value: JsonValue | undefined): value is JsonObject {
    return Object.isObject(value) && !Array.isArray(value);
  }

}
