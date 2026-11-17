/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import { join } from "node:path";
import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class GrokMcpBlockReader {
  public static read(profileDirectory: string, since: string): ReadonlyMap<string, string> {
    const blocks = new Map<string, string>();
    const lines = GrokMcpBlockReader.tailOf(join(profileDirectory, Resources.grokLogsDirectory, Resources.grokUnifiedLogFile));
    for (const line of lines.reverse()) {
      const entry = GrokMcpBlockReader.entryOf(line);
      const time = entry?.[Resources.grokLogTimeField];
      if (Object.isString(time) && time < since)
        break;
      const context = entry?.[Resources.grokLogContextField];
      if (Object.isNull(entry) || !Object.isString(time) || entry[Resources.grokLogMessageField] !== Resources.grokMcpBlockedMessage || !Object.isObject(context)
        || Array.isArray(context))
        continue;
      const fields = context as JsonObject;
      const server = fields[Resources.grokLogServerField];
      const reason = fields[Resources.grokLogReasonField];
      if (Object.isString(server) && Object.isString(reason) && !blocks.has(server))
        blocks.set(server, reason.replace(Resources.controlCharacters, " ").replace(Resources.pathFolders, String.empty).slice(0, Resources.maximumSummaryLength));
    }
    return blocks;
  }

  private static tailOf(path: string): string[] {
    try {
      const file = openSync(path, Resources.readFlag);
      try {
        const size = fstatSync(file).size;
        const length = Math.min(size, Resources.grokLogTailBytes);
        const buffer = Buffer.alloc(length);
        readSync(file, buffer, 0, length, size - length);
        const lines = buffer.toString(Resources.utf8Encoding).split(Resources.lineSeparator).filter(t => t.length > 0);
        return length < size ? lines.slice(1) : lines;
      }
      finally {
        closeSync(file);
      }
    }
    catch {
      return [];
    }
  }

  private static entryOf(line: string): JsonObject | null {
    try {
      const value: unknown = JSON.parse(line);
      return Object.isObject(value) && !Array.isArray(value) ? value as JsonObject : null;
    }
    catch {
      return null;
    }
  }
}
