/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type ProductIdentity from "../packages/product-identity.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import AppleSignatureCheck from "./apple-signature-check.ts";
import type IPackageSigning from "./interfaces/i-package-signing.ts";
import PackagingException from "./packaging.exception.ts";

export default class MacSigning implements IPackageSigning {
  public static readonly CREDENTIALS: readonly string[] = ["MAC_CERTIFICATE", "MAC_CERTIFICATE_PASSWORD", "APPLE_API_KEY_P8", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"];

  private static readonly KEY_FILE: string = "notarization-key.p8";
  private static readonly CHECK_FOLDER: string = "check";
  private static readonly DISK_IMAGE_EXTENSION: string = ".dmg";
  private static readonly NOTARIZATION_LIMIT: number = 3_900_000;
  private static readonly NOTARIZATION_WAIT: string = "1h";
  private static readonly STAPLE_LIMIT: number = 300_000;
  private static readonly ACCEPTED: RegExp = /"status"\s*:\s*"Accepted"/;
  private static readonly PRIVATE_FOLDER_MODE: number = 0o700;
  private static readonly PRIVATE_FILE_MODE: number = 0o600;

  private readonly runner: ProcessRunner;
  private readonly folder: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly key: string;
  private readonly keyId: string;
  private readonly issuer: string;

  public readonly builderEnvironment: NodeJS.ProcessEnv;

  public constructor(runner: ProcessRunner, folder: string, environment: NodeJS.ProcessEnv, credentials: NodeJS.ProcessEnv) {
    const missing = MacSigning.CREDENTIALS.filter(t => (credentials[t] ?? "").length === 0);
    if (missing.length > 0)
      throw new PackagingException(`Signing macOS packages needs ${missing.join(", ")}, the Developer ID Application certificate and the App Store Connect key that notarizes.`);
    this.runner = runner;
    this.folder = folder;
    this.environment = environment;
    this.key = String(credentials["APPLE_API_KEY_P8"]);
    this.keyId = String(credentials["APPLE_API_KEY_ID"]);
    this.issuer = String(credentials["APPLE_API_ISSUER"]);
    this.builderEnvironment = {
      CSC_IDENTITY_AUTO_DISCOVERY: "true",
      CSC_LINK: credentials["MAC_CERTIFICATE"],
      CSC_KEY_PASSWORD: credentials["MAC_CERTIFICATE_PASSWORD"],
      APPLE_API_KEY: path.join(folder, MacSigning.KEY_FILE),
      APPLE_API_KEY_ID: credentials["APPLE_API_KEY_ID"],
      APPLE_API_ISSUER: credentials["APPLE_API_ISSUER"]
    };
  }

  public async prepareAsync(): Promise<void> {
    await rm(this.folder, { recursive: true, force: true });
    await mkdir(this.folder, { recursive: true, mode: MacSigning.PRIVATE_FOLDER_MODE });
    await writeFile(path.join(this.folder, MacSigning.KEY_FILE), this.key, { mode: MacSigning.PRIVATE_FILE_MODE });
  }

  public async finishAsync(packages: readonly string[]): Promise<void> {
    for (const image of packages.filter(t => path.extname(t) === MacSigning.DISK_IMAGE_EXTENSION)) {
      const submitted = await this.runner.captureAsync("xcrun", [
        "notarytool", "submit", image, "--key", path.join(this.folder, MacSigning.KEY_FILE), "--key-id", this.keyId, "--issuer", this.issuer,
        "--wait", "--timeout", MacSigning.NOTARIZATION_WAIT, "--output-format", "json"
      ], this.folder, MacSigning.NOTARIZATION_LIMIT, this.environment);
      if (!submitted.isSuccessful || !MacSigning.ACCEPTED.test(submitted.text))
        throw new PackagingException(`Apple did not notarize the disk image ${image}:\n${submitted.text}`);
      const stapled = await this.runner.captureAsync("xcrun", ["stapler", "staple", image], this.folder, MacSigning.STAPLE_LIMIT, this.environment);
      if (!stapled.isSuccessful)
        throw new PackagingException(`The notarization ticket could not be stapled to the disk image ${image}:\n${stapled.text}`);
    }
  }

  public verifyAsync(packages: readonly string[], product: ProductIdentity): Promise<string> {
    return new AppleSignatureCheck(this.runner, path.join(this.folder, MacSigning.CHECK_FOLDER), this.environment).verifyAsync(packages, product.name);
  }

  public async disposeAsync(): Promise<void> {
    await rm(this.folder, { recursive: true, force: true });
  }
}
