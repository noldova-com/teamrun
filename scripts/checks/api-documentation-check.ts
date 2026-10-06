/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import type ApiCatalog from "../api/api-catalog.ts";
import ApiDeclarationSession from "../api/api-declaration-session.ts";
import ApiDocumentationReader from "../api/api-documentation.reader.ts";
import type ApiPackage from "../api/api-package.ts";
import ApiException from "../api/api.exception.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class ApiDocumentationCheck implements ICheck {
  private static readonly PURPOSE: string = "api-documentation";
  private static readonly NO_PACKAGES: string = "No packages under src/; there is no API documentation to check.\n";
  private static readonly VERDICT: string = "documents every public member";

  private readonly root: string;
  private readonly catalog: ApiCatalog;
  private readonly session: ApiDeclarationSession;

  public readonly title: string = "API documentation";

  public constructor(root: string, catalog: ApiCatalog, server: readonly string[], timeout: number) {
    this.root = root;
    this.catalog = catalog;
    this.session = new ApiDeclarationSession(root, server, timeout);
  }

  public async runAsync(output: Writable): Promise<boolean> {
    return await this.catalog.inspectEachAsync(output, ApiDocumentationCheck.NO_PACKAGES, ApiDocumentationCheck.VERDICT, t => this.inspectAsync(t));
  }

  private async inspectAsync(apiPackage: ApiPackage): Promise<readonly string[]> {
    try {
      return await this.session.useAsync(apiPackage, ApiDocumentationCheck.PURPOSE, [apiPackage.declarations],
        t => new ApiDocumentationReader(t, apiPackage.visibility, this.root).readAsync(apiPackage.declarations, apiPackage.sourceDeclarations));
    }
    catch (error) {
      return [ApiException.describe(error)];
    }
  }
}
