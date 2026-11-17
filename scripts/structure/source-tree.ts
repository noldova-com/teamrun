/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { PackageNaming } from "../packages/package-naming.ts";
import type { RepositoryFiles } from "../repository/repository-files.ts";
import { SourceFile } from "./source-file.ts";

export class SourceTree {
  public static readonly TEST_FOLDERS: ReadonlySet<string> = new Set(["tests", "e2e", "fixtures"]);

  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly SCANNED_EXTENSIONS: ReadonlySet<string> = new Set([
    ".ts", ".mts", ".cts", ".js", ".mjs", ".cjs", ".html", ".css", ".json"
  ]);
  private static readonly MANIFEST_NAME: string = "package.json";

  private readonly root: string;
  private readonly files: RepositoryFiles;

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async readAsync(): Promise<readonly SourceFile[]> {
    const listed = (await this.files.listAsync()).filter(t => t.startsWith(`${SourceTree.SOURCE_FOLDER}/`));
    const manifestFolders = new Set(listed.filter(t => path.posix.basename(t) === SourceTree.MANIFEST_NAME).map(t => path.posix.dirname(t)));
    const files: SourceFile[] = [];
    for (const file of listed) {
      const area = PackageNaming.locatePackageFolder(file);
      if (area === null || !SourceTree.SCANNED_EXTENSIONS.has(path.posix.extname(file)))
        continue;

      const isProduction = !file.split("/").some(t => SourceTree.TEST_FOLDERS.has(t));
      const text = await readFile(path.join(this.root, file), "utf8");
      files.push(new SourceFile(file, isProduction, SourceTree.findPackageRoot(file, area, manifestFolders), text));
    }
    return files;
  }

  private static findPackageRoot(file: string, area: string, manifestFolders: ReadonlySet<string>): string {
    let folder = path.posix.dirname(file);
    while (folder !== area && !manifestFolders.has(folder))
      folder = path.posix.dirname(folder);
    return folder;
  }
}
