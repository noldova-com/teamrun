/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import rootLock from "../../../package-lock.json" with { type: "json" };
import Config from "../../config.ts";
import Script from "../../script.ts";
import PackageOptionsFixture from "../packaging/fixtures/package-options.fixture.ts";

export default class PackageScriptFixture extends Script {
  public static rendererAvailable: boolean = true;
  public static dependencyVersion: string | null = null;
  public static readonly npmCommands: string[][] = [];
  public static readonly processCommands: string[][] = [];
  public static readonly compilerCommands: string[][] = [];
  public static readonly messages: string[] = [];

  public override async runAsync(): Promise<void> {
    throw new Error("Invoke the packaging command, not its process fixture.");
  }

  protected override async executeNpmCommandAsync(args: readonly string[], directory: string, _silent: boolean = false): Promise<void> {
    PackageScriptFixture.npmCommands.push([...args]);
    if (args[0] === "run" && PackageScriptFixture.rendererAvailable) {
      const renderer = path.join(directory, "_build/renderer/browser");
      await mkdir(renderer, { recursive: true });
      await writeFile(path.join(renderer, "index.html"), "fixture renderer");
    }
    if (args[0] === "ci") {
      const dependencies = Object.entries(rootLock.packages).filter(([location]) => location === "node_modules/@anthropic-ai/sdk"
        || location.includes("/node_modules/")).slice(0, 2);
      for (const [location, entry] of dependencies) {
        const target = path.join(directory, location);
        await mkdir(target, { recursive: true });
        await writeFile(path.join(target, "package.json"), JSON.stringify({ version: PackageScriptFixture.dependencyVersion ?? entry.version }));
      }
    }
  }

  protected override async executeProcessAsync(_command: string, args: readonly string[], _directory: string,
    _silent: boolean = false, _environment?: Readonly<Record<string, string>>): Promise<void> {
    PackageScriptFixture.processCommands.push([...args]);
    if (args[0] === "--test")
      return;
    const options = PackageOptionsFixture.current;
    if (options === null)
      throw new Error("Packaging options were not created.");
    await mkdir(options.outputDirectory, { recursive: true });
    if (options.directoryOnly)
      return;
    const suffixes = options.platform === "windows" ? ["-setup.exe", ".zip"] : options.platform === "mac" ? [".dmg", ".zip"] : [".AppImage"];
    const prefix = options.platform === "linux" ? "TeamRun-" : `TeamRun-${Config.VERSION}-`;
    for (const suffix of suffixes)
      await writeFile(path.join(options.outputDirectory, `${prefix}${options.targetName}${suffix}`), "fixture installer");
  }

  protected override async executeTypeScriptCompilerAsync(args: readonly string[], _directory: string = process.cwd()): Promise<void> {
    PackageScriptFixture.compilerCommands.push([...args]);
  }

  protected override writeLog(message: string, _overwrite: boolean = false): void {
    PackageScriptFixture.messages.push(message);
  }
}
