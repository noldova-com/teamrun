/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";

import type { Project } from "typescript/unstable/async";

import type ApiPackage from "./api-package.ts";
import ApiProject from "./api-project.ts";
import ApiServer from "./api-server.ts";
import ApiException from "./api.exception.ts";

export default class ApiDeclarationSession {
  private readonly root: string;
  private readonly server: readonly string[];
  private readonly timeout: number;

  public constructor(root: string, server: readonly string[], timeout: number) {
    this.root = root;
    this.server = [...server];
    this.timeout = timeout;
  }

  public async useAsync<T>(apiPackage: ApiPackage, purpose: string, read: (project: Project) => Promise<T>): Promise<T> {
    if (!existsSync(apiPackage.declarations))
      throw new ApiException(apiPackage.missingDeclarationsMessage);
    const project = new ApiProject(this.root, purpose, apiPackage.id);
    await project.writeAsync(apiPackage.project, this.root, [apiPackage.declarations]);
    return await ApiServer.useAsync(this.server, this.root, project.file, this.timeout, read);
  }
}
