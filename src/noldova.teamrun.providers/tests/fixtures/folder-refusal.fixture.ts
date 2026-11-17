/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class FolderRefusal {
  private static readonly EVERYONE: string = "*S-1-1-0";
  private static readonly REFUSED_CODES: readonly string[] = ["EACCES", "EPERM"];
  private static writesRefused: boolean | null = null;

  public static get refusesWrites(): boolean {
    if (process.platform !== "win32")
      return true;
    FolderRefusal.writesRefused ??= FolderRefusal.probeWrites();
    return FolderRefusal.writesRefused;
  }

  public static refuseWrites(folder: string): void {
    execFileSync("icacls", [folder, "/deny", `${FolderRefusal.EVERYONE}:(WD,AD)`]);
  }

  public static allowWrites(folder: string): void {
    execFileSync("icacls", [folder, "/remove:d", FolderRefusal.EVERYONE]);
  }

  private static probeWrites(): boolean {
    const refused = FolderRefusal.tryRefusedWrite();
    console.log(refused
      ? "Folder refusal: icacls deny entries refuse this process's writes, so the tests that need it deny with icacls."
      : "Folder refusal: icacls deny entries don't refuse this process's writes, so the tests that need it return early.");
    return refused;
  }

  private static tryRefusedWrite(): boolean {
    using cleanup = new DisposableStack();
    const probe = mkdtempSync(join(tmpdir(), "teamrun-refusal-"));
    cleanup.defer(() => rmSync(probe, { recursive: true, force: true }));
    FolderRefusal.refuseWrites(probe);
    cleanup.defer(() => FolderRefusal.allowWrites(probe));
    try {
      mkdirSync(join(probe, "made"), { recursive: true });
      return false;
    }
    catch (error) {
      if (!FolderRefusal.REFUSED_CODES.includes(typeof error === "object" && error !== null && "code" in error ? String(error.code) : ""))
        throw error;
      return true;
    }
  }
}
