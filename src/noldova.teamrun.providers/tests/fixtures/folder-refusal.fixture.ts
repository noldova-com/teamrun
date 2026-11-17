/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import fs, { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";

export class FolderRefusal {
  private static readonly EVERYONE: string = "*S-1-1-0";
  private static readonly REFUSED_CODES: readonly string[] = ["EACCES", "EPERM"];
  private static readonly undos: Map<string, () => void> = new Map();
  private static writesBind: boolean | null = null;

  public static refuseWrites(folder: string): void {
    if (FolderRefusal.bindWrites()) {
      execFileSync("icacls", [folder, "/deny", `${FolderRefusal.EVERYONE}:(WD,AD)`]);
      FolderRefusal.undos.set(folder, () => execFileSync("icacls", [folder, "/remove:d", FolderRefusal.EVERYONE]));
      return;
    }
    const original = fs.mkdirSync;
    fs.mkdirSync = new Proxy(original, { apply: (make, self, args: unknown[]): unknown =>
      FolderRefusal.isInside(folder, args[0]) ? FolderRefusal.throwRefusal("mkdir", args[0]) : Reflect.apply(make, self, args) });
    syncBuiltinESMExports();
    FolderRefusal.undos.set(folder, () => {
      fs.mkdirSync = original;
      syncBuiltinESMExports();
    });
  }

  public static allow(folder: string): void {
    const undo = FolderRefusal.undos.get(folder);
    FolderRefusal.undos.delete(folder);
    undo?.();
  }

  private static bindWrites(): boolean {
    FolderRefusal.writesBind ??= FolderRefusal.probeWrites();
    return FolderRefusal.writesBind;
  }

  private static probeWrites(): boolean {
    const binds = FolderRefusal.tryRefusedWrite();
    console.log(binds
      ? "Folder refusal: icacls deny entries refuse this process's writes, so the tests deny with icacls."
      : "Folder refusal: icacls deny entries don't refuse this process's writes, so the tests inject the refusal as EPERM.");
    return binds;
  }

  private static tryRefusedWrite(): boolean {
    using cleanup = new DisposableStack();
    const probe = mkdtempSync(join(tmpdir(), "teamrun-refusal-"));
    cleanup.defer(() => rmSync(probe, { recursive: true, force: true }));
    execFileSync("icacls", [probe, "/deny", `${FolderRefusal.EVERYONE}:(WD,AD)`]);
    cleanup.defer(() => execFileSync("icacls", [probe, "/remove:d", FolderRefusal.EVERYONE, "/t", "/c", "/q"]));
    try {
      mkdirSync(join(probe, "made"));
      return false;
    }
    catch (error) {
      if (!FolderRefusal.REFUSED_CODES.includes(typeof error === "object" && error !== null && "code" in error ? String(error.code) : ""))
        throw error;
      return true;
    }
  }

  private static isInside(folder: string, path: unknown): boolean {
    if (typeof path !== "string")
      return false;
    const inside = relative(folder, path);
    return inside.length > 0 && !inside.startsWith("..") && !isAbsolute(inside);
  }

  private static throwRefusal(syscall: string, path: unknown): never {
    throw Object.assign(new Error(`EPERM: operation not permitted, ${syscall} '${String(path)}'`), { code: "EPERM", errno: -4048, syscall, path: String(path) });
  }
}
