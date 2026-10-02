/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Project } from "typescript/unstable/async";

import ApiProject from "../../api/api-project.ts";
import ApiServer from "../../api/api-server.ts";
import type ApiPackageFixture from "./api-package.fixture.ts";
import SourceTreeFixture from "./source-tree.fixture.ts";

export default class ApiSessionFixture {
  private static readonly TIMEOUT: number = 30_000;

  public static async useAsync<T>(
    fixture: ApiPackageFixture,
    files: Readonly<Record<string, string>>,
    work: (project: Project, locate: (file: string) => string) => Promise<T>): Promise<T> {
    const locate = (file: string): string => path.join(fixture.directory, "work", file);
    for (const [file, text] of Object.entries(files)) {
      await mkdir(path.dirname(locate(file)), { recursive: true });
      await writeFile(locate(file), text);
    }
    await writeFile(path.join(fixture.directory, "package.json"), `${JSON.stringify({ type: "module" })}\n`);
    const project = new ApiProject(fixture.directory, "session", "work");
    await project.writeAsync(path.join(SourceTreeFixture.root, "tsconfig.base.json"), fixture.directory, Object.keys(files).map(t => locate(t)));
    return await ApiServer.useAsync([ApiServer.locateCompiler()], fixture.directory, project.file, ApiSessionFixture.TIMEOUT,
      t => work(t, locate));
  }
}
