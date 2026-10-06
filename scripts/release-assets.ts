/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import PackageException from "./packages/package.exception.ts";
import RootManifest from "./packages/root-manifest.ts";
import PackageLayout from "./packaging/package-layout.ts";
import PackageTarget from "./packaging/package-target.ts";
import PackagingException from "./packaging/packaging.exception.ts";
import ReleaseException from "./release/release.exception.ts";
import ReleaseFileSet from "./release/release-file-set.ts";

export default class ReleaseAssets {
  private static readonly USAGE: string = "Usage: npm run release:assets\n";
  private static readonly USAGE_EXIT_CODE: number = 2;

  private readonly root: string;
  private readonly platform: string;
  private readonly architecture: string;
  private readonly output: Writable;

  public constructor(root: string, platform: string, architecture: string, output: Writable) {
    this.root = root;
    this.platform = platform;
    this.architecture = architecture;
    this.output = output;
  }

  public async runAsync(assetArguments: readonly string[]): Promise<number> {
    if (assetArguments.length > 0) {
      this.output.write(ReleaseAssets.USAGE);
      return ReleaseAssets.USAGE_EXIT_CODE;
    }
    try {
      const target = PackageTarget.fromProcess(this.platform, this.architecture);
      const manifest = await RootManifest.readAsync(this.root);
      const names = await new ReleaseFileSet(manifest.product.name).writeAsync(new PackageLayout(this.root).output, target, manifest.productVersion, new Date().toISOString());
      this.output.write(`The release files of ${target.platform} ${target.architecture} for ${manifest.productVersion}:\n${names.join("\n")}\n`);
      return 0;
    }
    catch (error) {
      if (!(error instanceof ReleaseException || error instanceof PackagingException || error instanceof PackageException))
        throw error;
      this.output.write(`${error.message}\n`);
      return 1;
    }
  }
}

if (import.meta.main)
  process.exitCode = await new ReleaseAssets(process.cwd(), process.platform, process.arch, process.stdout).runAsync(process.argv.slice(2));
