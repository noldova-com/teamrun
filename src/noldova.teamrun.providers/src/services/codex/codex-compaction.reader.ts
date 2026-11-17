/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { JsonlTail } from "../jsonl-tail.js";
import { CodexSessionFile } from "./codex-session-file.js";

export class CodexCompactionReader {
  public static async read(codexHome: string, threadId: string): Promise<string | null> {
    const file = await CodexSessionFile.find(codexHome, threadId);
    if (Object.isNull(file))
      return null;
    const line = await JsonlTail.lastLineWith(file, Resources.codexCompactedMarker);
    if (Object.isNull(line))
      return null;
    const message = JsonReader.parse(line).readObject(Resources.codexPayloadField).readOptionalString(Resources.messageField) ?? String.empty;
    return message.trim().length === 0 ? null : message;
  }
}
