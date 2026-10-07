/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
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
      const layout = new PackageLayout(this.root);
      await ReleaseAssets.requireFeedAsync(layout.stagedProduct, manifest.product.updateFeed);
      const names = await new ReleaseFileSet(manifest.product.name).writeAsync(layout.output, target, manifest.productVersion, new Date().toISOString());
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

  private static async requireFeedAsync(file: string, expected: string): Promise<void> {
    let product: unknown;
    try {
      product = JSON.parse(await readFile(file, "utf8"));
    }
    catch (error) {
      throw new ReleaseException(`The packaged product file ${file} could not be read as JSON, so its update feed is unknown: ${String(error)}`, { cause: error });
    }
    const feed = typeof product === "object" && product !== null && "updateFeed" in product ? product.updateFeed : undefined;
    if (feed !== expected)
      throw new ReleaseException(`The packaged product file names the update feed ${JSON.stringify(feed ?? null)}, not ${expected}, so its packages cannot be released.`);
  }
}

if (import.meta.main)
  process.exitCode = await new ReleaseAssets(process.cwd(), process.platform, process.arch, process.stdout).runAsync(process.argv.slice(2));
