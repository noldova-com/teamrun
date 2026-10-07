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
  private static readonly APP_ASSESSMENT: readonly string[] = ["--type", "execute"];
  private static readonly DISK_IMAGE_ASSESSMENT: readonly string[] = ["--type", "open", "--context", "context:primary-signature"];
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
    await this.requireSignedAsync(`The disk image ${image}`, image, false, AppleSignatureCheck.DISK_IMAGE_ASSESSMENT);
    await this.runner.requireAsync("hdiutil", ["attach", "-readonly", "-nobrowse", "-noautoopen", "-mountpoint", mount, image], this.folder, AppleSignatureCheck.LIMIT,
      this.environment);
    try {
      await this.requireSignedAsync(`The app in ${image}`, path.join(mount, `${productName}${AppleSignatureCheck.APP_EXTENSION}`), true, AppleSignatureCheck.APP_ASSESSMENT);
      return `${image}: the disk image and its app each have a valid Developer ID Application signature, notarized and stapled.`;
    }
    finally {
      await this.runner.requireAsync("hdiutil", ["detach", mount, "-force"], this.folder, AppleSignatureCheck.LIMIT, this.environment);
    }
  }

  private async checkArchiveAsync(archive: string, folder: string, productName: string): Promise<string> {
    await this.runner.requireAsync("ditto", ["-x", "-k", archive, folder], this.folder, AppleSignatureCheck.LIMIT, this.environment);
    await this.requireSignedAsync(`The app in ${archive}`, path.join(folder, `${productName}${AppleSignatureCheck.APP_EXTENSION}`), true, AppleSignatureCheck.APP_ASSESSMENT);
    return `${archive}: a valid Developer ID Application signature, notarized and stapled.`;
  }

  private async requireSignedAsync(subject: string, file: string, isBundle: boolean, assessment: readonly string[]): Promise<void> {
    const verified = await this.captureAsync("codesign", ["--verify", ...(isBundle ? ["--deep"] : []), "--strict", "--verbose=2", file]);
    const details = await this.captureAsync("codesign", ["--display", "--verbose=2", file]);
    const assessed = await this.captureAsync("spctl", ["--assess", ...assessment, "--verbose=2", file]);
    const stapled = await this.captureAsync("xcrun", ["stapler", "validate", file]);
    const requirements: readonly (readonly [string, boolean])[] = [
      ["a valid signature", verified.isSuccessful],
      ["a Developer ID Application signature", details.isSuccessful && AppleSignatureCheck.DEVELOPER_ID.test(details.text)],
      ["notarization", assessed.isSuccessful && AppleSignatureCheck.NOTARIZED.test(assessed.text)],
      ["a stapled ticket", stapled.isSuccessful]
    ];
    const failed = requirements.filter(([, isMet]) => !isMet).map(([requirement]) => requirement);
    if (failed.length > 0)
      throw new PackagingException(`${subject} lacks ${failed.join(", ")}:\n${[verified, details, assessed, stapled].map(t => t.text).join(AppleSignatureCheck.LINE_SEPARATOR)}`);
  }

  private captureAsync(command: string, commandArguments: readonly string[]): Promise<ProcessResult> {
    return this.runner.captureAsync(command, commandArguments, this.folder, AppleSignatureCheck.LIMIT, this.environment);
  }
}
