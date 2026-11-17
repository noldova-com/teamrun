/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import { PackageException } from "../packages/package.exception.ts";
import { ProcessException } from "../processes/process.exception.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class ArchiveReuseCheck implements ICheck {
  public static readonly REBUILT: readonly string[] = ["@noldova/teamrun.cli", "@noldova/teamrun.window"];

  private readonly hashArchives: () => Promise<ReadonlyMap<string, string>>;
  private readonly rebuild: (names: readonly string[], output: Writable) => Promise<ReadonlyMap<string, boolean>>;

  public readonly title: string = "Same archives";

  public constructor(hashArchives: () => Promise<ReadonlyMap<string, string>>, rebuild: (names: readonly string[], output: Writable) => Promise<ReadonlyMap<string, boolean>>) {
    this.hashArchives = hashArchives;
    this.rebuild = rebuild;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    try {
      const before = await this.hashArchives();
      const built = await this.rebuild(ArchiveReuseCheck.REBUILT, output);
      const findings = ArchiveReuseCheck.compare(before, built, await this.hashArchives());
      for (const finding of findings)
        output.write(`${finding}\n`);
      if (findings.length === 0)
        output.write(`Rebuilt ${ArchiveReuseCheck.REBUILT.join(" and ")} at the same time, packed the same archives and reused the other packages: ${built.size - ArchiveReuseCheck.REBUILT.length}.\n`);
      return findings.length === 0;
    }
    catch (error) {
      if (!(error instanceof PackageException || error instanceof ProcessException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }
  }

  private static compare(before: ReadonlyMap<string, string>, built: ReadonlyMap<string, boolean>, after: ReadonlyMap<string, string>): readonly string[] {
    const findings: string[] = ArchiveReuseCheck.REBUILT.filter(t => !built.has(t)).map(t => `${t} isn't a package under src/, so the check can't rebuild it.`);
    for (const [name, isBuilt] of built) {
      const isRebuilt = ArchiveReuseCheck.REBUILT.includes(name);
      if (isBuilt !== isRebuilt)
        findings.push(isRebuilt
          ? `${name} was reused, though the check rebuilds it.`
          : `${name} was built, though it is reused when the rebuilt archives are the same as before.`);
    }
    for (const [name, hash] of before) {
      const rebuilt = after.get(name);
      if (rebuilt !== hash)
        findings.push(`${name}'s archive differs from the one before the rebuild: ${hash} before, ${rebuilt ?? "none"} after.`);
    }
    return findings;
  }
}
