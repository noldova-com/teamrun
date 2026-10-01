/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

export class CorruptDatabaseFixture {
  private static readonly PAGE_SIZE: number = 512;

  public static async writeAsync(file: string): Promise<void> {
    const database = new DatabaseSync(file);
    let root: unknown;
    try {
      database.exec(`PRAGMA page_size = ${CorruptDatabaseFixture.PAGE_SIZE}; CREATE TABLE t (a TEXT); CREATE INDEX i ON t (a);`);
      for (let index = 0; index < 5; index++)
        database.prepare("INSERT INTO t VALUES (?)").run(`key-${index}`);
      root = database.prepare("SELECT rootpage FROM sqlite_schema WHERE name = 'i'").get()?.["rootpage"];
    }
    finally {
      database.close();
    }

    const bytes = await readFile(file);
    const page = bytes.subarray((Number(root) - 1) * CorruptDatabaseFixture.PAGE_SIZE, Number(root) * CorruptDatabaseFixture.PAGE_SIZE);
    page.write("key-9", page.indexOf("key-3"));
    await writeFile(file, bytes);
  }
}
