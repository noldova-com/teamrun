/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { access, rm } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import { ProcessException } from "../../../../scripts/processes/process.exception.ts";
import { DocsPageGenerator } from "./docs-page-generator.ts";

export class DocsPreparation {
  private static readonly DEPENDENCIES_FOLDER: string = "node_modules";
  private static readonly MISSING_CODE: string = "ENOENT";

  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public async prepareAsync(output: Writable): Promise<void> {
    try {
      await access(path.join(this.root, DocsPreparation.DEPENDENCIES_FOLDER));
    }
    catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === DocsPreparation.MISSING_CODE))
        throw error;
      throw new ProcessException("The docs site builds with the root's packages, which are not installed; run npm ci first.", { cause: error });
    }
    await rm(path.join(this.root, DocsPageGenerator.GENERATED_FOLDER), { recursive: true, force: true });
    const pages = new DocsPageGenerator(this.root);
    const count = await pages.writePagesAsync();
    await pages.writeIndexAsync();
    output.write(`Wrote the text of ${count} pages and the page shell to ${DocsPageGenerator.GENERATED_FOLDER}.\n`);
  }
}
