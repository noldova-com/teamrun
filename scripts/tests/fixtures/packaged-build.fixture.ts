/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type GalleryFile from "../../angular/gallery-file.ts";
import ProcessRunnerFixture from "./process-runner.fixture.ts";

export default class PackagedBuildFixture extends ProcessRunnerFixture {
  public static readonly WINDOW: string = "<!doctype html><title>Fixture Studio</title>\n";

  private readonly gallery: GalleryFile;
  private readonly window: string;
  private readonly isPackaged: boolean;

  public constructor(gallery: GalleryFile, exitCodes: readonly number[] = [], window: string = PackagedBuildFixture.WINDOW, isPackaged: boolean = true) {
    super(exitCodes);

    this.gallery = gallery;
    this.window = window;
    this.isPackaged = isPackaged;
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string): Promise<number | null> {
    const output = String(commandArguments.at(-1));
    await this.gallery.writeAsync(this.isPackaged);
    await mkdir(path.join(output, "window", "browser"), { recursive: true });
    await writeFile(path.join(output, "window", "browser", "index.html"), this.window);
    await writeFile(path.join(output, "window", "3rdpartylicenses.txt"), "Third-party licenses\n");
    return super.runAsync(command, commandArguments, directory);
  }
}
