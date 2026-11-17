/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomBytes } from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { ModuleDatabases } from "./module-databases.ts";

export class LargeImageDetail {
  private static readonly MESSAGES_TABLE: string = "messages";
  private static readonly FILE_CHANGE: RegExp = /"kind":"FileChange"/;
  private static readonly PNG_PATH: RegExp = /"path":"[^"]+\.png"/;
  private static readonly IMAGE_BYTES: number = 1_300_000;

  public static add(data: string): string {
    let added = "none";
    for (const file of ModuleDatabases.find(data)) {
      const database = new DatabaseSync(file);
      try {
        if (!ModuleDatabases.hasTable(database, LargeImageDetail.MESSAGES_TABLE))
          continue;
        const rows = database.prepare("SELECT rowid AS id, json FROM messages ORDER BY rowid DESC").all() as { id: number; json: string }[];
        const row = rows.find(t => LargeImageDetail.FILE_CHANGE.test(t.json) && LargeImageDetail.PNG_PATH.test(t.json));
        if (row === undefined)
          continue;
        const message = JSON.parse(row.json) as { id: string; createdAt: string; details: { createdAt: string }[] } & Record<string, unknown>;
        const base64 = randomBytes(LargeImageDetail.IMAGE_BYTES).toString("base64");
        message.details.push({ sequence: message.details.length, kind: "Note", text: "Generated image",
          payload: { toolCallId: "t1", kind: "other", title: "generate_image", status: "completed",
            content: [{ type: "content", content: { type: "image", data: base64, mimeType: "image/png" } }], files: [], tool: "other" },
          createdAt: message.details.at(-1)?.createdAt ?? message.createdAt } as { createdAt: string });
        database.prepare("UPDATE messages SET json = ? WHERE rowid = ?").run(JSON.stringify(message), row.id);
        added = `${path.relative(data, file)} message ${message.id} (${base64.length} base64 characters)`;
      }
      finally {
        database.close();
      }
    }
    return added;
  }
}
