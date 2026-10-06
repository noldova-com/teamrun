/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import { DiagnosticCategory, type Project } from "typescript/unstable/async";

import type ApiCatalog from "../api/api-catalog.ts";
import ApiDeclarationSession from "../api/api-declaration-session.ts";
import type ApiPackage from "../api/api-package.ts";
import ApiSurfaceReader from "../api/api-surface.reader.ts";
import ApiException from "../api/api.exception.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class ApiDeclarationCheck implements ICheck {
  private static readonly PURPOSE: string = "api-declarations";
  private static readonly NO_PACKAGES: string = "No packages under src/; there are no API declarations to compare.\n";
  private static readonly VERDICT: string = "matches its declarations";

  private readonly catalog: ApiCatalog;
  private readonly session: ApiDeclarationSession;

  public readonly title: string = "API declarations";

  public constructor(root: string, catalog: ApiCatalog, server: readonly string[], timeout: number) {
    this.catalog = catalog;
    this.session = new ApiDeclarationSession(root, server, timeout);
  }

  public async runAsync(output: Writable): Promise<boolean> {
    return await this.catalog.inspectEachAsync(output, ApiDeclarationCheck.NO_PACKAGES, ApiDeclarationCheck.VERDICT, t => this.inspectAsync(t));
  }

  private static async readErrorsAsync(project: Project, file: string): Promise<readonly string[]> {
    const diagnostics = [...await project.program.getSyntacticDiagnostics(file), ...await project.program.getSemanticDiagnostics(file)];
    return diagnostics.filter(t => t.category === DiagnosticCategory.Error).map(t => `TS${t.code}: ${t.text}`);
  }

  private async inspectAsync(apiPackage: ApiPackage): Promise<readonly string[]> {
    try {
      return await this.session.useAsync(apiPackage, ApiDeclarationCheck.PURPOSE, [apiPackage.implementation, apiPackage.declarations], async t => {
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
