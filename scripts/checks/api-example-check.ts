/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import type ApiCatalog from "../api/api-catalog.ts";
import ApiDeclarationSession from "../api/api-declaration-session.ts";
import type ApiExample from "../api/api-example.ts";
import ApiExampleReader from "../api/api-example.reader.ts";
import type ApiExamples from "../api/api-examples.ts";
import type ApiPackage from "../api/api-package.ts";
import ApiProject from "../api/api-project.ts";
import ApiException from "../api/api.exception.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import LicenseHeader from "../structure/license-header.ts";
import TypeScriptCompiler from "../toolchain/typescript-compiler.ts";
import type ICheck from "./interfaces/check.ts";

export default class ApiExampleCheck implements ICheck {
  private static readonly PURPOSE: string = "api-examples";
  private static readonly NO_PACKAGES: string = "No packages under src/; there are no API examples to compile.\n";
  private static readonly VERDICT: string = "every example compiles";
  private static readonly COMPILER_ARGUMENTS: readonly string[] = ["--pretty", "false", "--project"];
  private static readonly HEADER: string = `${LicenseHeader.BLOCK}\n`;
  private static readonly HEADER_LINES: number = ApiExampleCheck.HEADER.split("\n").length - 1;
  private static readonly MODULE_MANIFEST: string = "package.json";
  private static readonly MODULE_TYPE: string = `${JSON.stringify({ type: "module" })}\n`;
  private static readonly DIAGNOSTIC: RegExp = /^(.+?)\((\d+),(\d+)\): (.*)$/;

  private readonly root: string;
  private readonly catalog: ApiCatalog;
  private readonly runner: ProcessRunner;
  private readonly session: ApiDeclarationSession;
  private readonly timeout: number;

  public readonly title: string = "API examples";

  public constructor(root: string, catalog: ApiCatalog, runner: ProcessRunner, server: readonly string[], timeout: number) {
    this.root = root;
    this.catalog = catalog;
    this.runner = runner;
    this.session = new ApiDeclarationSession(root, server, timeout);
    this.timeout = timeout;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    return await this.catalog.inspectEachAsync(output, ApiExampleCheck.NO_PACKAGES, ApiExampleCheck.VERDICT, t => this.inspectAsync(t));
  }

  private static describe(examples: readonly ApiExample[], line: string): string {
    const match = ApiExampleCheck.DIAGNOSTIC.exec(line);
    const example = match === null ? undefined : examples.find(t => path.basename(String(match[1])) === t.fileName);
    if (match === null || example === undefined)
      return line;
    return `${example.title}, line ${Number(match[2]) - ApiExampleCheck.HEADER_LINES}: ${match[4]}`;
  }

  private async inspectAsync(apiPackage: ApiPackage): Promise<readonly string[]> {
    try {
      const found = await this.session.useAsync(apiPackage, `${ApiExampleCheck.PURPOSE}-reading`, [apiPackage.declarations],
        t => new ApiExampleReader(t, apiPackage.visibility).readAsync(apiPackage.declarations));
      return [...found.undocumented.map(t => `${t} has no @example`), ...await this.compileAsync(apiPackage, found)];
    }
    catch (error) {
      return [ApiException.describe(error)];
    }
  }

  private async compileAsync(apiPackage: ApiPackage, found: ApiExamples): Promise<readonly string[]> {
    if (found.examples.length === 0)
      return [];
    const project = new ApiProject(apiPackage.exampleRoot, ApiExampleCheck.PURPOSE, apiPackage.id);
    await rm(project.folder, { recursive: true, force: true });
    const files = found.examples.map(t => path.join(project.folder, t.fileName));
    await project.writeAsync(apiPackage.project, this.root, files, apiPackage.paths);
    await writeFile(path.join(project.folder, ApiExampleCheck.MODULE_MANIFEST), ApiExampleCheck.MODULE_TYPE);
    await Promise.all(found.examples.map(t => writeFile(path.join(project.folder, t.fileName), `${ApiExampleCheck.HEADER}${t.code}`)));
    const result = await this.runner.captureAsync(process.execPath, [TypeScriptCompiler.locate(), ...ApiExampleCheck.COMPILER_ARGUMENTS, project.file], this.root, this.timeout);
    if (result.exitCode === 0)
      return [];
    const lines = `${result.output}${result.errorOutput}`.split(/\r?\n/).filter(t => t.trim() !== "");
    return [`the compiler exited with code ${result.exitCode}`, ...lines.map(t => ApiExampleCheck.describe(found.examples, t))];
  }
}
