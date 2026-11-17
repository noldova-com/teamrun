/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import { CpuProfile } from "./cpu-profile.ts";
import { ProfileException } from "./profile.exception.ts";
import { ProfileGroup } from "./profile-group.ts";
import { ProfileSources } from "./profile-sources.ts";

export class ProfileRead {
  public static readonly USAGE: string = "Usage: npm run profile:read -- <profile> [--groups <group>,...] [--top <count>]\n"
    + `A group is one of ${ProfileGroup.KNOWN.map(t => t.name).join(", ")}, or <name>=<function>+<function>.\n`;
  public static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly GROUPS_OPTION: string = "--groups";
  private static readonly TOP_OPTION: string = "--top";
  private static readonly GROUP_SEPARATOR: string = ",";
  private static readonly DEFAULT_TOP: number = 8;
  private static readonly COUNT: RegExp = /^\d+$/;
  private static readonly PARENT_SNIPPETS: number = 2;
  private static readonly PARENT_SNIPPET_LENGTH: number = 200;

  private readonly output: Writable;

  public constructor(output: Writable) {
    this.output = output;
  }

  public async runAsync(args: readonly string[]): Promise<number> {
    const [file, ...options] = args;
    let groups: readonly ProfileGroup[] = [];
    let top = ProfileRead.DEFAULT_TOP;
    try {
      for (let index = 0; index < options.length; index += 2) {
        const [option, value] = [options[index], options[index + 1]];
        if (option === ProfileRead.GROUPS_OPTION && value !== undefined)
          groups = value.split(ProfileRead.GROUP_SEPARATOR).map(t => ProfileGroup.parse(t));
        else if (option === ProfileRead.TOP_OPTION && value !== undefined && ProfileRead.COUNT.test(value))
          top = Number(value);
        else
          return this.usage();
      }
      if (file === undefined || file.startsWith("--"))
        return this.usage();
      this.output.write(this.format(CpuProfile.parse(await readFile(file, "utf8")), path.basename(file), groups, top,
        new ProfileSources(path.join(path.dirname(file), ProfileSources.FOLDER))));
      return 0;
    }
    catch (error) {
      if (!(error instanceof ProfileException || error instanceof SyntaxError || (error instanceof Error && "code" in error)))
        throw error;
      this.output.write(`${file ?? ""}: ${error.message}\n`);
      return 1;
    }
  }

  public format(profile: CpuProfile, name: string, groups: readonly ProfileGroup[], top: number, sources: ProfileSources): string {
    const totals = [...profile.inclusiveMillisecondsOf(groups)].map(([group, milliseconds]) => `${group} ${milliseconds.toFixed(0)} ms`);
    const lines = [`${name}: span ${profile.spanMilliseconds.toFixed(0)} ms, busy ${profile.busyMilliseconds.toFixed(0)} ms${totals.length > 0 ? `; ${totals.join(", ")}` : ""}`];
    for (const time of profile.topSelfTimes(top)) {
      lines.push(`${time.milliseconds.toFixed(0)} ms ${time.node.label}`, `   src: ${sources.snippetOf(time.node)}`);
      if (time.callers.length > 0)
        lines.push(`   <- ${time.callers.map(t => t.label).join(" <- ")}`);
      for (const parent of time.callers.slice(0, ProfileRead.PARENT_SNIPPETS).filter(t => t.url.length > 0))
        lines.push(`   parent src: ${sources.snippetOf(parent).slice(0, ProfileRead.PARENT_SNIPPET_LENGTH)}`);
    }
    return `${lines.join("\n")}\n`;
  }

  private usage(): number {
    this.output.write(ProfileRead.USAGE);
    return ProfileRead.USAGE_EXIT_CODE;
  }
}

if (import.meta.main)
  process.exitCode = await new ProfileRead(process.stdout).runAsync(process.argv.slice(2));
