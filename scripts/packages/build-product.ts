/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type BuildVariant from "../modules/build-variant.ts";
import RootManifest from "./root-manifest.ts";

export default class BuildProduct {
  private static readonly FILE_SEGMENTS: readonly string[] = ["_build", "product.json"];
  private static readonly OUTPUT_FILE: string = "product.json";

  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public async writeAsync(fingerprint: string, outputFolder: string | null, variant: BuildVariant): Promise<void> {
    const manifest = await RootManifest.readAsync(this.root);
    const product = manifest.product;
    const document = {
      name: product.name,
      slug: product.slug,
      applicationId: product.applicationId,
      developmentApplicationId: product.developmentApplicationId,
      dataFolder: product.dataFolder,
      deviceFolders: { windows: product.windowsDeviceFolder, macos: product.macosDeviceFolder, linux: product.linuxDeviceFolder },
      dataDirectoryVariable: product.dataDirectoryVariable,
      icons: product.icons,
      windowsPublisher: product.windowsPublisher,
      updateFeed: variant.isPackaged ? variant.updateFeed ?? product.updateFeed : null,
      version: manifest.productVersion,
      build: fingerprint
    };
    const file = this.locate(outputFolder);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(document, null, 2)}\n`);
  }

  private locate(outputFolder: string | null): string {
    return outputFolder === null ? path.join(this.root, ...BuildProduct.FILE_SEGMENTS) : path.join(outputFolder, BuildProduct.OUTPUT_FILE);
  }
}
