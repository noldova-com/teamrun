/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import type RepositoryFiles from "../repository/repository-files.ts";
import SourceFile from "./source-file.ts";
import SourceInventory from "./source-inventory.ts";

export default class SourceTree {
  public static readonly TEST_FOLDERS: ReadonlySet<string> = new Set(["tests", "e2e", "fixtures"]);
  public static readonly SHELL_OWNER: string = "shell";

  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly MODULES_FOLDER: string = "src/modules";
  private static readonly MODULE_FILE: RegExp = /^src\/modules\/([^/]+)\/./;
  private static readonly SHELL_FILE: RegExp = /^src\/(?:shell|foundation)\/./;
  private static readonly SHELL_AREA_DEPTH: number = 2;
  private static readonly SCANNED_EXTENSIONS: ReadonlySet<string> = new Set([
    ".ts", ".mts", ".cts", ".js", ".mjs", ".cjs", ".html", ".css", ".scss", ".json"
  ]);
  private static readonly MANIFEST_NAME: string = "package.json";

  private readonly root: string;
  private readonly files: RepositoryFiles;

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async readAsync(): Promise<SourceInventory> {
    const listed = (await this.files.listAsync()).filter(t => t.startsWith(`${SourceTree.SOURCE_FOLDER}/`));
    const manifestFolders = new Set(listed.filter(t => path.posix.basename(t) === SourceTree.MANIFEST_NAME).map(t => path.posix.dirname(t)));
    const moduleIds = new Set<string>();
    const files: SourceFile[] = [];
    for (const file of listed) {
      const moduleId = SourceTree.MODULE_FILE.exec(file)?.[1];
      if (moduleId === undefined && !SourceTree.SHELL_FILE.test(file))
        continue;

      if (moduleId !== undefined)
        moduleIds.add(moduleId);
      if (!SourceTree.SCANNED_EXTENSIONS.has(path.posix.extname(file)))
        continue;

      const segments = file.split("/");
      const owner = moduleId ?? SourceTree.SHELL_OWNER;
      const area = moduleId === undefined ? segments.slice(0, SourceTree.SHELL_AREA_DEPTH).join("/") : `${SourceTree.MODULES_FOLDER}/${moduleId}`;
      const isProduction = !segments.some(t => SourceTree.TEST_FOLDERS.has(t));
      const text = await readFile(path.join(this.root, file), "utf8");
      files.push(new SourceFile(file, owner, isProduction, SourceTree.findPackageRoot(file, area, manifestFolders), text));
    }
    return new SourceInventory([...moduleIds].sort(), files);
  }

  private static findPackageRoot(file: string, area: string, manifestFolders: ReadonlySet<string>): string {
    let folder = path.posix.dirname(file);
    while (folder !== area && !manifestFolders.has(folder))
      folder = path.posix.dirname(folder);
    return folder;
  }
}
