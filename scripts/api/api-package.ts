/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import ApiException from "./api.exception.ts";

export default class ApiPackage {
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly PROJECT_FILE: string = "tsconfig.json";
  private static readonly IMPLEMENTATION: readonly string[] = ["api", "index.ts"];
  private static readonly DEPENDENCY_FOLDER: string = "node_modules";
  private static readonly NAME_PATTERN: RegExp = /^@[a-z0-9-]+\/[a-z0-9-]+$/;
  private static readonly ID_PATTERN: RegExp = /^@[a-z0-9-]+\//;

  public readonly name: string;
  public readonly id: string;
  public readonly project: string;
  public readonly implementation: string;
  public readonly declarations: string;

  public constructor(name: string, id: string, project: string, implementation: string, declarations: string) {
    this.name = name;
    this.id = id;
    this.project = project;
    this.implementation = implementation;
    this.declarations = declarations;
  }

  public static async readAsync(root: string, manifest: string): Promise<ApiPackage> {
    const directory = path.join(root, path.dirname(manifest));
    const parsed: unknown = JSON.parse(await readFile(path.join(root, manifest), "utf8"));
    const name = typeof parsed === "object" && parsed !== null && "name" in parsed ? parsed.name : undefined;
    const types = typeof parsed === "object" && parsed !== null && "types" in parsed ? parsed.types : undefined;
    if (typeof name !== "string" || !ApiPackage.NAME_PATTERN.test(name) || typeof types !== "string")
      throw new ApiException(`${manifest} needs a scoped "name" and a "types" entry.`);
    return new ApiPackage(
      name,
      name.replace(ApiPackage.ID_PATTERN, ""),
      path.join(directory, ApiPackage.SOURCE_FOLDER, ApiPackage.PROJECT_FILE),
      path.join(directory, ApiPackage.SOURCE_FOLDER, ...ApiPackage.IMPLEMENTATION),
      path.join(root, ApiPackage.DEPENDENCY_FOLDER, ...name.split("/"), types));
  }
}
