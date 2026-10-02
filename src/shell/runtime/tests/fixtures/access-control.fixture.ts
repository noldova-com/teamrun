/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export class AccessControlFixture {
  public static readSddl(target: string): string {
    const folder = mkdtempSync(path.join(tmpdir(), "teamrun-access-"));
    try {
      const file = path.join(folder, "access.sddl");
      AccessControlFixture.runAccessCommand([target, "/save", file]);
      return readFileSync(file, "utf16le").trim().split(/\r?\n/).join(" ");
    }
    finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }

  public static runAccessCommand(commandArguments: readonly string[]): void {
    execFileSync(path.join(process.env["SystemRoot"] ?? "", "System32", "icacls.exe"), commandArguments, { encoding: "utf8" });
  }
}
