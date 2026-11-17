/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import fs, { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";

export class FolderRefusal {
  private static readonly EVERYONE: string = "*S-1-1-0";
  private static readonly REFUSED_CODES: readonly string[] = ["EACCES", "EPERM"];
  private static readonly undos: Map<string, () => void> = new Map();
  private static writesBind: boolean | null = null;
  private static removalsBind: boolean | null = null;

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

  public static refuseRemoval(folder: string, file: string): void {
    if (FolderRefusal.bindRemovals()) {
      execFileSync("icacls", [join(folder, file), "/deny", `${FolderRefusal.EVERYONE}:(DE)`]);
      execFileSync("icacls", [folder, "/deny", `${FolderRefusal.EVERYONE}:(DC)`]);
      FolderRefusal.undos.set(folder, () => {
        execFileSync("icacls", [folder, "/remove:d", FolderRefusal.EVERYONE]);
        execFileSync("icacls", [join(folder, file), "/remove:d", FolderRefusal.EVERYONE]);
      });
      return;
    }
    const original = fs.promises.rm;
    fs.promises.rm = new Proxy(original, { apply: (remove, self, args: unknown[]): unknown =>
      FolderRefusal.isAt(folder, args[0]) || FolderRefusal.isInside(folder, args[0])
        ? Promise.reject(FolderRefusal.refusal("rm", args[0]))
        : Reflect.apply(remove, self, args) });
    syncBuiltinESMExports();
    FolderRefusal.undos.set(folder, () => {
      fs.promises.rm = original;
      syncBuiltinESMExports();
    });
  }

  public static allow(folder: string): void {
    const undo = FolderRefusal.undos.get(folder);
    FolderRefusal.undos.delete(folder);
    undo?.();
  }

  private static bindWrites(): boolean {
    FolderRefusal.writesBind ??= FolderRefusal.probe("writes", probe => {
      execFileSync("icacls", [probe, "/deny", `${FolderRefusal.EVERYONE}:(WD,AD)`]);
      return () => mkdirSync(join(probe, "made"));
    });
    return FolderRefusal.writesBind;
  }

  private static bindRemovals(): boolean {
    FolderRefusal.removalsBind ??= FolderRefusal.probe("removals", probe => {
      writeFileSync(join(probe, "kept"), "kept");
      execFileSync("icacls", [join(probe, "kept"), "/deny", `${FolderRefusal.EVERYONE}:(DE)`]);
      execFileSync("icacls", [probe, "/deny", `${FolderRefusal.EVERYONE}:(DC)`]);
      return () => rmSync(join(probe, "kept"));
    });
    return FolderRefusal.removalsBind;
  }

  private static probe(kind: string, deny: (probe: string) => () => void): boolean {
    const probe = mkdtempSync(join(tmpdir(), "teamrun-refusal-"));
    let binds: boolean;
    try {
      const attempt = deny(probe);
      try {
        attempt();
        binds = false;
      }
      catch (error) {
        if (!FolderRefusal.REFUSED_CODES.includes(typeof error === "object" && error !== null && "code" in error ? String(error.code) : ""))
          throw error;
        binds = true;
      }
    }
    finally {
      execFileSync("icacls", [probe, "/remove:d", FolderRefusal.EVERYONE, "/t", "/c", "/q"]);
      rmSync(probe, { recursive: true, force: true });
    }
    console.log(binds
      ? `Folder refusal: icacls deny entries refuse this process's ${kind}, so the tests deny with icacls.`
      : `Folder refusal: icacls deny entries don't refuse this process's ${kind}, so the tests inject the refusal as EPERM.`);
    return binds;
  }

  private static isInside(folder: string, path: unknown): boolean {
    if (typeof path !== "string")
      return false;
    const inside = relative(folder, path);
    return inside.length > 0 && !inside.startsWith("..") && !isAbsolute(inside);
  }

  private static isAt(folder: string, path: unknown): boolean {
    return typeof path === "string" && relative(folder, path).length === 0;
  }

  private static throwRefusal(syscall: string, path: unknown): never {
    throw FolderRefusal.refusal(syscall, path);
  }

  private static refusal(syscall: string, path: unknown): NodeJS.ErrnoException {
    return Object.assign(new Error(`EPERM: operation not permitted, ${syscall} '${String(path)}'`), { code: "EPERM", errno: -4048, syscall, path: String(path) });
  }
}
