/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export default class GalleryFile {
  public static readonly MARKERS: readonly string[] = ["tr-gallery-scope-frame", "tr-gallery-forms", "Show the keyboard focus on the first control"];

  private static readonly FILE_SEGMENTS: readonly string[] = ["src", "generated", "gallery.ts"];
  private static readonly TYPE_IMPORT: string = "import type { Type } from \"@angular/core\";\n";
  private static readonly GALLERY_IMPORT: string = "import { GalleryComponent } from \"@noldova/teamrun-shell-ui\";\n";
  private static readonly LICENSE_HEADER: string = [
    "/**",
    " * @license",
    " * Copyright (c) Noldova.",
    " *",
    " * This source code is licensed under the license found in the",
    " * LICENSE file in the root directory of this source tree.",
    " */",
    ""
  ].join("\n");

  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public get file(): string {
    return path.join(this.root, ...GalleryFile.FILE_SEGMENTS);
  }

  public async writeAsync(isPackaged: boolean): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(this.file, GalleryFile.contentOf(isPackaged));
  }

  public async isPackagedAsync(): Promise<boolean> {
    return await readFile(this.file, "utf8") === GalleryFile.contentOf(true);
  }

  private static contentOf(isPackaged: boolean): string {
    const imports = isPackaged ? GalleryFile.TYPE_IMPORT : `${GalleryFile.GALLERY_IMPORT}${GalleryFile.TYPE_IMPORT}`;
    return `${GalleryFile.LICENSE_HEADER}\n${imports}\nexport const gallery: Type<unknown> | null = ${isPackaged ? "null" : "GalleryComponent"};\n`;
  }
}
