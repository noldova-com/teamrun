/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import PackageException from "./packages/package.exception.ts";
import ProductIdentity from "./packages/product-identity.ts";
import ReleaseException from "./release/release.exception.ts";
import ReleaseSigning from "./release/release-signing.ts";

export default class SignedPlatforms {
  private static readonly USAGE: string = "Usage: node scripts/signed-platforms.ts\n";
  private static readonly USAGE_EXIT_CODE: number = 2;

  private readonly root: string;
  private readonly output: Writable;

  public constructor(root: string, output: Writable) {
    this.root = root;
    this.output = output;
  }

  public async runAsync(commandArguments: readonly string[]): Promise<number> {
    if (commandArguments.length > 0) {
      this.output.write(SignedPlatforms.USAGE);
      return SignedPlatforms.USAGE_EXIT_CODE;
    }
    try {
      const product = await ProductIdentity.readAsync(this.root);
      const platforms = (await ReleaseSigning.readAsync(this.root)).listSignedPlatforms(product, product.releaseRepository);
      this.output.write(`${platforms.join(" ")}\n`);
      return 0;
    }
    catch (error) {
      if (!(error instanceof ReleaseException || error instanceof PackageException))
        throw error;
      this.output.write(`${error.message}\n`);
      return 1;
    }
  }
}

if (import.meta.main)
  process.exitCode = await new SignedPlatforms(process.cwd(), process.stdout).runAsync(process.argv.slice(2));
