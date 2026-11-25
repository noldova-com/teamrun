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

import "@noldova/context.core";

import { JsonFields } from "../totals/json-fields.ts";
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
        const rows = database.prepare("SELECT rowid AS id, json FROM messages ORDER BY rowid DESC").all();
        const row = rows.find(t => LargeImageDetail.isImageChange(t["json"]));
        if (Object.isUndefined(row))
          continue;
        const message = JsonFields.record(JSON.parse(String(row["json"])));
        const details = message["details"];
        if (!Array.isArray(details))
          continue;
        const base64 = randomBytes(LargeImageDetail.IMAGE_BYTES).toString("base64");
        details.push({ sequence: details.length, kind: "Note", text: "Generated image",
          payload: { toolCallId: "t1", kind: "other", title: "generate_image", status: "completed",
            content: [{ type: "content", content: { type: "image", data: base64, mimeType: "image/png" } }], files: [], tool: "other" },
          createdAt: JsonFields.read(details.at(-1), "createdAt") ?? message["createdAt"] });
        database.prepare("UPDATE messages SET json = ? WHERE rowid = ?").run(JSON.stringify(message), Number(row["id"]));
        added = `${path.relative(data, file)} message ${String(message["id"])} (${base64.length} base64 characters)`;
      }
      finally {
        database.close();
      }
    }
    return added;
  }

  private static isImageChange(json: unknown): boolean {
    return Object.isString(json) && LargeImageDetail.FILE_CHANGE.test(json) && LargeImageDetail.PNG_PATH.test(json);
  }
}
