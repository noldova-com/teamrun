/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import type ProcessResult from "../processes/process-result.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import PackagingException from "./packaging.exception.ts";

export default class AppleSignatureCheck {
  private static readonly DISK_IMAGE_EXTENSION: string = ".dmg";
  private static readonly APP_EXTENSION: string = ".app";
  private static readonly LIMIT: number = 300_000;
  private static readonly DEVELOPER_ID: RegExp = /^Authority=Developer ID Application: /m;
  private static readonly NOTARIZED: RegExp = /^source=Notarized Developer ID$/m;
  private static readonly LINE_SEPARATOR: string = "\n";

  private readonly runner: ProcessRunner;
  private readonly folder: string;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(runner: ProcessRunner, folder: string, environment: NodeJS.ProcessEnv) {
    this.runner = runner;
    this.folder = folder;
    this.environment = environment;
  }

  public async verifyAsync(packages: readonly string[], productName: string): Promise<string> {
    await rm(this.folder, { recursive: true, force: true });
    await mkdir(this.folder, { recursive: true });
    const lines: string[] = [];
    try {
      for (const [index, file] of packages.entries()) {
        const work = path.join(this.folder, String(index));
        await mkdir(work);
        lines.push(path.extname(file) === AppleSignatureCheck.DISK_IMAGE_EXTENSION
          ? await this.checkDiskImageAsync(file, work, productName)
          : await this.checkArchiveAsync(file, work, productName));
      }
    }
    finally {
      await rm(this.folder, { recursive: true, force: true });
    }
    return lines.join(AppleSignatureCheck.LINE_SEPARATOR);
  }

  private async checkDiskImageAsync(image: string, mount: string, productName: string): Promise<string> {
    await this.runner.requireAsync("hdiutil", ["attach", "-readonly", "-nobrowse", "-noautoopen", "-mountpoint", mount, image], this.folder, AppleSignatureCheck.LIMIT,
      this.environment);
    try {
      return await this.checkAppAsync(image, path.join(mount, `${productName}${AppleSignatureCheck.APP_EXTENSION}`));
    }
    finally {
      await this.runner.requireAsync("hdiutil", ["detach", mount, "-force"], this.folder, AppleSignatureCheck.LIMIT, this.environment);
    }
  }

  private async checkArchiveAsync(archive: string, folder: string, productName: string): Promise<string> {
    await this.runner.requireAsync("ditto", ["-x", "-k", archive, folder], this.folder, AppleSignatureCheck.LIMIT, this.environment);
    return this.checkAppAsync(archive, path.join(folder, `${productName}${AppleSignatureCheck.APP_EXTENSION}`));
  }

  private async checkAppAsync(source: string, app: string): Promise<string> {
    const verified = await this.captureAsync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app]);
    const details = await this.captureAsync("codesign", ["--display", "--verbose=2", app]);
    const assessed = await this.captureAsync("spctl", ["--assess", "--type", "execute", "--verbose=2", app]);
    const stapled = await this.captureAsync("xcrun", ["stapler", "validate", app]);
    const failed = ([
      ["a valid signature", verified.isSuccessful],
      ["a Developer ID Application signature", details.isSuccessful && AppleSignatureCheck.DEVELOPER_ID.test(details.text)],
      ["notarization", assessed.isSuccessful && AppleSignatureCheck.NOTARIZED.test(assessed.text)],
      ["a stapled ticket", stapled.isSuccessful]
    ] as const).filter(([, isMet]) => !isMet).map(([requirement]) => requirement);
    if (failed.length > 0)
      throw new PackagingException(`The app in ${source} lacks ${failed.join(", ")}:\n${[verified, details, assessed, stapled].map(t => t.text).join(AppleSignatureCheck.LINE_SEPARATOR)}`);
    return `${source}: a valid Developer ID Application signature, notarized and stapled.`;
  }

  private captureAsync(command: string, commandArguments: readonly string[]): Promise<ProcessResult> {
    return this.runner.captureAsync(command, commandArguments, this.folder, AppleSignatureCheck.LIMIT, this.environment);
  }
}
