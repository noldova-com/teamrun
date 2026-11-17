/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { basename, dirname, join } from "node:path";
import "@noldova/context.core";
import type { JsonObject, JsonReader, JsonValue } from "@noldova/context.json";
import type { Provider } from "@noldova/teamrun.protocol";

import type { ISavedImageReader } from "../../interfaces/i-saved-image.reader.js";
import type { SavedImage } from "../../models/saved-image.js";
import { Resources } from "../../resources.js";
import { SavedImageFile } from "../saved-image-file.js";
import type { GrokHome } from "./grok-home.js";

export class GrokImageReader implements ISavedImageReader {
  private readonly home: GrokHome;

  public constructor(home: GrokHome) {
    this.home = home;
  }

  public read(tool: JsonReader, sessionId: string, provider: Provider | null): SavedImage | null {
    const output = GrokImageReader.objectOf(tool.toJson()[Resources.acpRawOutputField]);
    if (Object.isNull(output) || !Resources.grokImageOutputTypes.includes(String(output[Resources.typeField])))
      return null;
    const path = output[Resources.pathField];
    if (!SavedImageFile.isPlain(path))
      return null;
    const sessions = SavedImageFile.realPathOf(join(this.home.of(provider), Resources.grokSessionsDirectory));
    const target = SavedImageFile.realPathOf(path);
    if (Object.isNull(sessions) || Object.isNull(target) || !SavedImageFile.isInside(sessions, target) || !Resources.grokImageNamePattern.test(basename(target))
      || basename(dirname(target)) !== Resources.grokImagesDirectory || basename(dirname(dirname(target))) !== sessionId)
      return null;
    return SavedImageFile.read(path, target, t => SavedImageFile.isInside(sessions, t));
  }

  public failureOf(tool: JsonReader): JsonObject | null {
    const json = tool.toJson();
    const variant = GrokImageReader.objectOf(json[Resources.acpRawInputField])?.[Resources.grokImageVariantField];
    if (json[Resources.statusField] !== Resources.acpFailedStatus || !Resources.grokImageOutputTypes.includes(String(variant)))
      return null;
    const output = GrokImageReader.objectOf(json[Resources.acpRawOutputField]) ?? {};
    return Object.fromEntries([Resources.errorField, Resources.messageField].flatMap(t => {
      const value = output[t];
      return Object.isString(value) ? [[t, value.length > Resources.maximumSummaryLength ? `${value.slice(0, Resources.maximumSummaryLength)}${Resources.ellipsis}` : value]] : [];
    }));
  }

  private static objectOf(value: JsonValue | undefined): JsonObject | null {
    return Object.isObject(value) && !Array.isArray(value) ? value as JsonObject : null;
  }
}
