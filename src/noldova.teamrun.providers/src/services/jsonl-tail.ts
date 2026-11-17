/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { open } from "node:fs/promises";

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class JsonlTail {
  private static readonly newline: number = 0x0a;

  public static async lastLineWith(file: string, text: string): Promise<string | null> {
    const marker = Buffer.from(text, Resources.utf8Encoding);
    const handle = await open(file);
    try {
      let end = (await handle.stat()).size;
      let tail = Buffer.alloc(0);
      while (end > 0) {
        const start = Math.max(0, end - Resources.jsonlTailChunkBytes);
        const chunk = Buffer.alloc(end - start);
        await handle.read(chunk, 0, chunk.length, start);
        tail = Buffer.concat([chunk, tail]);
        end = start;
        const at = tail.lastIndexOf(marker);
        const from = at < 0 ? -1 : tail.lastIndexOf(JsonlTail.newline, at);
        if (at >= 0 && (from >= 0 || end === 0)) {
          const to = tail.indexOf(JsonlTail.newline, at);
          return tail.subarray(from + 1, to < 0 ? tail.length : to).toString(Resources.utf8Encoding);
        }
        const first = tail.indexOf(JsonlTail.newline);
        tail = at >= 0 || first < 0 ? tail : tail.subarray(0, first + 1);
      }
      return null;
    }
    finally {
      await handle.close();
    }
  }
}
