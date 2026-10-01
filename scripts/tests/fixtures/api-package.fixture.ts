/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import SourceTreeFixture from "./source-tree.fixture.ts";

export default class ApiPackageFixture {
  private static readonly PREFIX: string = "teamrun-api-fixture-";
  private static readonly SCOPE: string = "@noldova";
  private static readonly NAME_PREFIX: string = "teamrun-foundation-";

  public readonly directory: string;

  private constructor(directory: string) {
    this.directory = directory;
  }

  public static async createAsync(): Promise<ApiPackageFixture> {
    return new ApiPackageFixture(await mkdtemp(path.join(tmpdir(), ApiPackageFixture.PREFIX)));
  }

  public async writePackageAsync(id: string, implementation: Readonly<Record<string, string>>, declarations: string | null): Promise<string> {
    const name = `${ApiPackageFixture.NAME_PREFIX}${id}`;
    const source = `src/foundation/${id}`;
    const project = { extends: path.join(SourceTreeFixture.root, "tsconfig.base.json"), compilerOptions: { types: [] } };
    const files: Record<string, string> = {
      [`${source}/package.json`]: `${JSON.stringify({ name: `${ApiPackageFixture.SCOPE}/${name}`, type: "module", types: "api/index.d.ts" }, null, 2)}\n`,
      [`${source}/src/tsconfig.json`]: `${JSON.stringify(project, null, 2)}\n`,
      ...Object.fromEntries(Object.entries(implementation).map(([file, text]) => [`${source}/src/${file}`, text]))
    };
    if (declarations !== null) {
      files[`node_modules/${ApiPackageFixture.SCOPE}/${name}/package.json`] = `${JSON.stringify({ name: `${ApiPackageFixture.SCOPE}/${name}`, types: "api/index.d.ts" })}\n`;
      files[`node_modules/${ApiPackageFixture.SCOPE}/${name}/api/index.d.ts`] = declarations;
    }
    for (const [file, text] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(this.directory, file)), { recursive: true });
      await writeFile(path.join(this.directory, file), text);
    }
    return `${source}/package.json`;
  }

  public async disposeAsync(): Promise<void> {
    await rm(this.directory, { recursive: true, force: true });
  }
}
