/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import type { Writable } from "node:stream";

import type ApiCatalog from "../api/api-catalog.ts";
import ApiDocumentationReader from "../api/api-documentation.reader.ts";
import type ApiPackage from "../api/api-package.ts";
import ApiProject from "../api/api-project.ts";
import ApiServer from "../api/api-server.ts";
import ApiException from "../api/api.exception.ts";
import type ICheck from "./interfaces/check.ts";

export default class ApiDocumentationCheck implements ICheck {
  private static readonly PURPOSE: string = "api-documentation";
  private static readonly NO_PACKAGES: string = "No packages under src/; there is no API documentation to check.\n";

  private readonly root: string;
  private readonly catalog: ApiCatalog;
  private readonly server: readonly string[];
  private readonly timeout: number;

  public readonly title: string = "API documentation";

  public constructor(root: string, catalog: ApiCatalog, server: readonly string[], timeout: number) {
    this.root = root;
    this.catalog = catalog;
    this.server = [...server];
    this.timeout = timeout;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const apiPackages = await this.catalog.listOrReportAsync(output);
    if (apiPackages === undefined)
      return false;
    if (apiPackages.length === 0) {
      output.write(ApiDocumentationCheck.NO_PACKAGES);
      return true;
    }

    let passed = true;
    for (const apiPackage of apiPackages) {
      const problems = await this.inspectAsync(apiPackage);
      output.write(problems.length === 0 ? `${apiPackage.directory}: documents every public member\n` : `${apiPackage.directory}:\n${problems.map(t => `  ${t}\n`).join("")}`);
      passed &&= problems.length === 0;
    }
    return passed;
  }

  private async inspectAsync(apiPackage: ApiPackage): Promise<readonly string[]> {
    if (!existsSync(apiPackage.declarations))
      return [apiPackage.missingDeclarationsMessage];
    const project = new ApiProject(this.root, ApiDocumentationCheck.PURPOSE, apiPackage.id);
    await project.writeAsync(apiPackage.project, this.root, [apiPackage.declarations]);
    try {
      return await ApiServer.useAsync(this.server, this.root, project.file, this.timeout,
        t => new ApiDocumentationReader(t, apiPackage.visibility).readAsync(apiPackage.declarations));
    }
    catch (error) {
      return [ApiException.describe(error)];
    }
  }
}
