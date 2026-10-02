/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import type { Writable } from "node:stream";

import { DiagnosticCategory, type Project } from "typescript/unstable/async";

import ApiPackage from "../api/api-package.ts";
import ApiProject from "../api/api-project.ts";
import ApiServer from "../api/api-server.ts";
import ApiSurfaceReader from "../api/api-surface.reader.ts";
import ApiException from "../api/api.exception.ts";
import type BuildLayout from "../packages/build-layout.ts";
import type PackageCatalog from "../packages/package-catalog.ts";
import type ICheck from "./interfaces/check.ts";

export default class ApiDeclarationCheck implements ICheck {
  private static readonly PURPOSE: string = "api-declarations";
  private static readonly NO_PACKAGES: string = "No packages under src/; there are no API declarations to compare.\n";

  private readonly root: string;
  private readonly catalog: PackageCatalog;
  private readonly layout: BuildLayout;
  private readonly server: readonly string[];
  private readonly timeout: number;

  public readonly title: string = "API declarations";

  public constructor(root: string, catalog: PackageCatalog, layout: BuildLayout, server: readonly string[], timeout: number) {
    this.root = root;
    this.catalog = catalog;
    this.layout = layout;
    this.server = [...server];
    this.timeout = timeout;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const manifests = await this.catalog.listPackagesAsync(false);
    if (manifests.length === 0) {
      output.write(ApiDeclarationCheck.NO_PACKAGES);
      return true;
    }

    let passed = true;
    for (const manifest of manifests) {
      const problems = await this.inspectAsync(new ApiPackage(this.layout, manifest));
      output.write(problems.length === 0 ? `${manifest.directory}: matches its declarations\n` : `${manifest.directory}:\n${problems.map(t => `  ${t}\n`).join("")}`);
      passed &&= problems.length === 0;
    }
    return passed;
  }

  private static async readErrorsAsync(project: Project, file: string): Promise<readonly string[]> {
    const diagnostics = [...await project.program.getSyntacticDiagnostics(file), ...await project.program.getSemanticDiagnostics(file)];
    return diagnostics.filter(t => t.category === DiagnosticCategory.Error).map(t => `TS${t.code}: ${t.text}`);
  }

  private async inspectAsync(apiPackage: ApiPackage): Promise<readonly string[]> {
    if (!existsSync(apiPackage.declarations))
      return [`no installed declarations at ${apiPackage.declarations}; build the packages first`];
    const project = new ApiProject(this.root, ApiDeclarationCheck.PURPOSE, apiPackage.id);
    await project.writeAsync(apiPackage.project, this.root, [apiPackage.implementation, apiPackage.declarations]);
    try {
      return await ApiServer.useAsync(this.server, this.root, project.file, this.timeout, async t => {
        const errors = await ApiDeclarationCheck.readErrorsAsync(t, apiPackage.declarations);
        if (errors.length > 0)
          return errors;
        const reader = new ApiSurfaceReader(t);
        return (await reader.readAsync(apiPackage.implementation)).compare(await reader.readAsync(apiPackage.declarations));
      });
    }
    catch (error) {
      return [ApiException.describe(error)];
    }
  }
}
