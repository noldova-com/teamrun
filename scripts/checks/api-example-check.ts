/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import type ApiExample from "../api/api-example.ts";
import ApiExampleReader from "../api/api-example.reader.ts";
import type ApiExamples from "../api/api-examples.ts";
import ApiPackage from "../api/api-package.ts";
import ApiProject from "../api/api-project.ts";
import ApiServer from "../api/api-server.ts";
import ApiException from "../api/api.exception.ts";
import type BuildLayout from "../packages/build-layout.ts";
import type PackageCatalog from "../packages/package-catalog.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import LicenseHeader from "../structure/license-header.ts";
import TypeScriptCompiler from "../toolchain/typescript-compiler.ts";
import type ICheck from "./interfaces/check.ts";

export default class ApiExampleCheck implements ICheck {
  private static readonly PURPOSE: string = "api-examples";
  private static readonly NO_PACKAGES: string = "No packages under src/; there are no API examples to compile.\n";
  private static readonly COMPILER_ARGUMENTS: readonly string[] = ["--pretty", "false", "--project"];
  private static readonly HEADER: string = `${LicenseHeader.BLOCK}\n`;
  private static readonly HEADER_LINES: number = ApiExampleCheck.HEADER.split("\n").length - 1;
  private static readonly MODULE_MANIFEST: string = "package.json";
  private static readonly MODULE_TYPE: string = `${JSON.stringify({ type: "module" })}\n`;
  private static readonly DIAGNOSTIC: RegExp = /^(.+?)\((\d+),(\d+)\): (.*)$/;

  private readonly root: string;
  private readonly catalog: PackageCatalog;
  private readonly layout: BuildLayout;
  private readonly runner: ProcessRunner;
  private readonly server: readonly string[];
  private readonly timeout: number;

  public readonly title: string = "API examples";

  public constructor(root: string, catalog: PackageCatalog, layout: BuildLayout, runner: ProcessRunner, server: readonly string[], timeout: number) {
    this.root = root;
    this.catalog = catalog;
    this.layout = layout;
    this.runner = runner;
    this.server = [...server];
    this.timeout = timeout;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const manifests = await this.catalog.listPackagesAsync(false);
    if (manifests.length === 0) {
      output.write(ApiExampleCheck.NO_PACKAGES);
      return true;
    }

    let passed = true;
    for (const manifest of manifests) {
      const problems = await this.inspectAsync(new ApiPackage(this.layout, manifest));
      output.write(problems.length === 0 ? `${manifest.directory}: every example compiles\n` : `${manifest.directory}:\n${problems.map(t => `  ${t}\n`).join("")}`);
      passed &&= problems.length === 0;
    }
    return passed;
  }

  private static describe(examples: readonly ApiExample[], line: string): string {
    const match = ApiExampleCheck.DIAGNOSTIC.exec(line);
    const example = match === null ? undefined : examples.find(t => path.basename(String(match[1])) === t.fileName);
    if (match === null || example === undefined)
      return line;
    return `${example.title}, line ${Number(match[2]) - ApiExampleCheck.HEADER_LINES}: ${match[4]}`;
  }

  private async inspectAsync(apiPackage: ApiPackage): Promise<readonly string[]> {
    if (!existsSync(apiPackage.declarations))
      return [`no installed declarations at ${apiPackage.declarations}; build the packages first`];
    try {
      const reading = new ApiProject(this.root, `${ApiExampleCheck.PURPOSE}-reading`, apiPackage.id);
      await reading.writeAsync(apiPackage.project, this.root, [apiPackage.declarations]);
      const found = await ApiServer.useAsync(this.server, this.root, reading.file, this.timeout,
        t => new ApiExampleReader(t).readAsync(apiPackage.declarations));
      return [...found.undocumented.map(t => `${t} has no @example`), ...await this.compileAsync(apiPackage, found)];
    }
    catch (error) {
      return [ApiException.describe(error)];
    }
  }

  private async compileAsync(apiPackage: ApiPackage, found: ApiExamples): Promise<readonly string[]> {
    if (found.examples.length === 0)
      return [];
    const project = new ApiProject(this.root, ApiExampleCheck.PURPOSE, apiPackage.id);
    await rm(project.folder, { recursive: true, force: true });
    const files = found.examples.map(t => path.join(project.folder, t.fileName));
    await project.writeAsync(apiPackage.project, this.root, files);
    await writeFile(path.join(project.folder, ApiExampleCheck.MODULE_MANIFEST), ApiExampleCheck.MODULE_TYPE);
    await Promise.all(found.examples.map(t => writeFile(path.join(project.folder, t.fileName), `${ApiExampleCheck.HEADER}${t.code}`)));
    const result = await this.runner.captureAsync(process.execPath, [TypeScriptCompiler.locate(), ...ApiExampleCheck.COMPILER_ARGUMENTS, project.file], this.root, this.timeout);
    if (result.exitCode === 0)
      return [];
    const lines = `${result.output}${result.errorOutput}`.split(/\r?\n/).filter(t => t.trim() !== "");
    return [`the compiler exited with code ${result.exitCode}`, ...lines.map(t => ApiExampleCheck.describe(found.examples, t))];
  }
}
