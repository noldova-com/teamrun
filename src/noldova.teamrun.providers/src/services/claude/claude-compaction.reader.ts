/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { ConfigurationUnreadableException } from "../../exceptions/configuration-unreadable.exception.js";
import { Resources } from "../../resources.js";
import { JsonlTail } from "../jsonl-tail.js";
import { ClaudeSessionFile } from "./claude-session-file.js";

export class ClaudeCompactionReader {
  public static async read(configDir: string, sessionId: string): Promise<string | null> {
    const file = await ClaudeSessionFile.find(configDir, sessionId);
    if (Object.isNull(file))
      return null;
    const line = await JsonlTail.lastLineWith(file, Resources.claudeCompactSummaryMarker);
    if (Object.isNull(line))
      return null;
    const content = JsonReader.parse(line).readObject(Resources.messageField).readValue(Resources.contentField);
    if (!Object.isString(content))
      throw new ConfigurationUnreadableException(Resources.formatClaudeCompactSummaryNotText(file));
    return content;
  }
}
