/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import PackageException from "../packages/package.exception.ts";
import type ProductIdentity from "../packages/product-identity.ts";
import type SourceFile from "../structure/source-file.ts";
import SourceScanner from "../structure/source-scanner.ts";
import type SourceTree from "../structure/source-tree.ts";
import type ICheck from "./interfaces/check.ts";

export default class ProductIdentityCheck implements ICheck {
  private static readonly SHELL_PREFIX: string = "src/shell/";
  private static readonly LINE_SEPARATOR: string = "\n";
  private static readonly SPECIAL_CHARACTERS: RegExp = /[.*+?^${}()|[\]\\]/g;

  private readonly tree: SourceTree;
  private readonly readProductAsync: () => Promise<ProductIdentity>;

  public readonly title: string = "Product identity";

  public constructor(tree: SourceTree, readProductAsync: () => Promise<ProductIdentity>) {
    this.tree = tree;
    this.readProductAsync = readProductAsync;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    let product: ProductIdentity;
    try {
      product = await this.readProductAsync();
    }
    catch (error) {
      if (!(error instanceof PackageException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }

    const patterns = product.literals.map(t => [t, new RegExp(`(?<![@\\w-])${t.replace(ProductIdentityCheck.SPECIAL_CHARACTERS, "\\$&")}(?![\\w-])`, "g")] as const);
    const files = (await this.tree.readAsync()).files.filter(t => t.isProduction && t.path.startsWith(ProductIdentityCheck.SHELL_PREFIX));
    const findings = files.flatMap(t => ProductIdentityCheck.findIdentity(t, patterns));
    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked ${files.length} production files of the shell for the product's identity.\n`);
    return findings.length === 0;
  }

  private static findIdentity(file: SourceFile, patterns: readonly (readonly [string, RegExp])[]): readonly string[] {
    return ProductIdentityCheck.readTexts(file).flatMap(([text, line]) => {
      const matches = patterns.flatMap(([value, pattern]) => [...text.matchAll(pattern)].map(t => ({ value, start: t.index, end: t.index + value.length })));
      return matches
        .filter(t => !matches.some(u => u !== t && u.start <= t.start && u.end >= t.end && u.end - u.start > t.end - t.start))
        .sort((first, second) => first.start - second.start)
        .map(t => `${file.formatLocation(line)}: spells "${t.value}"; the shell takes the product's identity from the build's product file through ProductInfo.`);
    });
  }

  private static readTexts(file: SourceFile): readonly (readonly [string, number])[] {
    if (!file.isScript && !file.isJson)
      return file.text.split(ProductIdentityCheck.LINE_SEPARATOR).map((t, index) => [t, index + 1] as const);
    const source = new SourceScanner(file.text).scan();
    return [...source.selectors, ...source.texts].sort((first, second) => first.line - second.line).map(t => [t.value, t.line] as const);
  }
}
