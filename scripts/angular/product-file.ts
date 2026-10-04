/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import ProductIdentity from "../packages/product-identity.ts";
import LicenseHeader from "../structure/license-header.ts";

export default class ProductFile {
  private static readonly FILE_SEGMENTS: readonly string[] = ["src", "generated", "product.ts"];

  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public get file(): string {
    return path.join(this.root, ...ProductFile.FILE_SEGMENTS);
  }

  public async writeAsync(): Promise<void> {
    const product = await ProductIdentity.readAsync(this.root);
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(this.file, `${LicenseHeader.BLOCK}\nexport const productName: string = ${JSON.stringify(product.name)};\n`);
  }
}
