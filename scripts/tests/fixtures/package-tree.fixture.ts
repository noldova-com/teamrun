/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import PackageManifest from "../../packages/package-manifest.ts";
import PackageNameFixture from "./package-name.fixture.ts";
import ProductIdentityFixture from "./product-identity.fixture.ts";
import type RepositoryFixture from "./repository.fixture.ts";
import SourceTreeFixture from "./source-tree.fixture.ts";

export default class PackageTreeFixture {
  public static async writeRootAsync(repository: RepositoryFixture, modules: readonly string[] = []): Promise<void> {
    await repository.writeAsync({
      "package.json": `${JSON.stringify({ name: "fixture", version: "0.0.7", teamrun: { protocolVersion: 3, modules, product: ProductIdentityFixture.json }, private: true, type: "module" }, null, 2)}\n`,
      "package-lock.json": `${JSON.stringify({ name: "fixture", version: "0.0.7", lockfileVersion: 3, requires: true, packages: { "": { name: "fixture", version: "0.0.7" } } }, null, 2)}\n`,
      "tsconfig.base.json": await readFile(path.join(SourceTreeFixture.root, "tsconfig.base.json"), "utf8"),
      "LICENSE": "Fixture license\n"
    });
  }

  public static async writePackageAsync(
    repository: RepositoryFixture,
    id: string,
    dependencies: readonly string[],
    withTests: boolean = true,
    withResources: boolean = true,
    directory: string = `src/${id.replace("-", "/")}`): Promise<void> {
    const base = `${"../".repeat(directory.split("/").length + 1)}tsconfig.base.json`;
    const project = `${JSON.stringify({ extends: base }, null, 2)}\n`;
    const imports = dependencies.map(t => `import { Resources as ${PackageTreeFixture.formatSymbol(t)} } from "${PackageNameFixture.forId(t)}";\n`).join("");
    const uses = dependencies.map(t => `${PackageTreeFixture.formatSymbol(t)}.version`).join(", ");
    const files: Record<string, string> = {
      [`${directory}/package.json`]: `${JSON.stringify({
        name: PackageManifest.formatName(directory),
        version: "__VERSION__",
        private: true,
        type: "module",
        main: "api/index.js",
        types: "api/index.d.ts",
        dependencies: Object.fromEntries(dependencies.map(t => [PackageNameFixture.forId(t), "__VERSION__"]))
      }, null, 2)}\n`,
      [`${directory}/src/tsconfig.json`]: project,
      [`${directory}/src/resources.ts`]: "export default class Resources {\n  public static readonly version: string = \"__VERSION__\";\n  public static readonly protocol: string = \"__PROTOCOL_VERSION__\";\n}\n",
      [`${directory}/src/api/index.ts`]: `${imports}export { default as Resources } from "../resources.js";\nexport const dependencies: readonly string[] = [${uses}];\n`,
      [`${directory}/src/api/index.d.ts`]: "export declare class Resources {\n  static readonly version: string;\n  static readonly protocol: string;\n}\nexport declare const dependencies: readonly string[];\n"
    };
    if (!withResources) {
      delete files[`${directory}/src/resources.ts`];
      files[`${directory}/src/api/index.ts`] = `${imports}export const dependencies: readonly string[] = [${uses}];\n`;
      files[`${directory}/src/api/index.d.ts`] = "export declare const dependencies: readonly string[];\n";
    }
    if (withTests) {
      files[`${directory}/tests/tsconfig.json`] = project;
      files[`${directory}/tests/api/index.test.ts`] = `import { Resources } from "${PackageManifest.formatName(directory)}";\n\nexport const version: string = Resources.version;\n`;
    }
    await repository.writeAsync(files);
  }

  private static formatSymbol(id: string): string {
    return id.replace(/-(.)/g, (_, t: string) => t.toUpperCase()).replace(/^./, t => t.toUpperCase());
  }
}
