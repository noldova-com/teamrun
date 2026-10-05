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

import type ApiCatalog from "../api/api-catalog.ts";
import type ApiPackage from "../api/api-package.ts";
import ApiProject from "../api/api-project.ts";
import ApiServer from "../api/api-server.ts";
import ApiSurfaceReader from "../api/api-surface.reader.ts";
import ApiException from "../api/api.exception.ts";
import type ICheck from "./interfaces/check.ts";

export default class ApiDeclarationCheck implements ICheck {
  private static readonly PURPOSE: string = "api-declarations";
  private static readonly NO_PACKAGES: string = "No packages under src/; there are no API declarations to compare.\n";
  private static readonly VERDICT: string = "matches its declarations";

  private readonly root: string;
  private readonly catalog: ApiCatalog;
  private readonly server: readonly string[];
  private readonly timeout: number;

  public readonly title: string = "API declarations";

  public constructor(root: string, catalog: ApiCatalog, server: readonly string[], timeout: number) {
    this.root = root;
    this.catalog = catalog;
    this.server = [...server];
    this.timeout = timeout;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    return await this.catalog.inspectEachAsync(output, ApiDeclarationCheck.NO_PACKAGES, ApiDeclarationCheck.VERDICT, t => this.inspectAsync(t));
  }

  private static async readErrorsAsync(project: Project, file: string): Promise<readonly string[]> {
    const diagnostics = [...await project.program.getSyntacticDiagnostics(file), ...await project.program.getSemanticDiagnostics(file)];
    return diagnostics.filter(t => t.category === DiagnosticCategory.Error).map(t => `TS${t.code}: ${t.text}`);
  }

  private async inspectAsync(apiPackage: ApiPackage): Promise<readonly string[]> {
    if (!existsSync(apiPackage.declarations))
      return [apiPackage.missingDeclarationsMessage];
    const project = new ApiProject(this.root, ApiDeclarationCheck.PURPOSE, apiPackage.id);
    await project.writeAsync(apiPackage.project, this.root, [apiPackage.implementation, apiPackage.declarations]);
    try {
      return await ApiServer.useAsync(this.server, this.root, project.file, this.timeout, async t => {
        const errors = await ApiDeclarationCheck.readErrorsAsync(t, apiPackage.declarations);
        if (errors.length > 0)
          return errors;
        const reader = new ApiSurfaceReader(t, apiPackage.visibility);
        return (await reader.readAsync(apiPackage.implementation)).compare(await reader.readAsync(apiPackage.declarations));
      });
    }
    catch (error) {
      return [ApiException.describe(error)];
    }
  }
}
