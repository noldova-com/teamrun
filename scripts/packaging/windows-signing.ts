/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import type ProductIdentity from "../packages/product-identity.ts";
import WindowsAddonBuilder from "../packages/windows-addon-builder.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import AuthenticodeCheck from "./authenticode-check.ts";
import type IPackageSigning from "./interfaces/i-package-signing.ts";
import PackageConfiguration from "./package-configuration.ts";
import type PackageTarget from "./package-target.ts";
import PackagingException from "./packaging.exception.ts";
import type PinnedPackage from "./pinned-package.ts";
import TrustedSigningModule from "./trusted-signing-module.ts";
import WindowsSigningAccount from "./windows-signing-account.ts";

export default class WindowsSigning implements IPackageSigning {
  public static readonly CREDENTIALS: readonly string[] = [...TrustedSigningModule.CREDENTIALS, ...WindowsSigningAccount.VARIABLES];

  private static readonly FOLDER_PREFIX: string = "win";
  private static readonly UNPACKED_FOLDER_SUFFIX: string = "unpacked";
  private static readonly X64: string = "x64";
  private static readonly PROGRAM_EXTENSION: string = ".exe";

  private readonly runner: ProcessRunner;
  private readonly root: string;
  private readonly output: string;
  private readonly target: PackageTarget;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly module: TrustedSigningModule;
  private readonly packages: readonly PinnedPackage[];

  public readonly builderEnvironment: NodeJS.ProcessEnv;

  public constructor(runner: ProcessRunner, root: string, folder: string, output: string, target: PackageTarget, environment: NodeJS.ProcessEnv, credentials: NodeJS.ProcessEnv,
    packages: readonly PinnedPackage[]) {
    this.runner = runner;
    this.root = root;
    this.output = output;
    this.target = target;
    this.environment = environment;
    this.module = new TrustedSigningModule(runner, folder, WindowsSigningAccount.fromCredentials(credentials), environment);
    this.packages = packages;
    this.builderEnvironment = this.module.describeEnvironment(credentials);
  }

  public prepareAsync(): Promise<void> {
    return this.module.prepareAsync(this.packages);
  }

  public finishAsync(): Promise<string> {
    return Promise.resolve("");
  }

  public async verifyAsync(packages: readonly string[], product: ProductIdentity): Promise<string> {
    const folder = [WindowsSigning.FOLDER_PREFIX, ...(this.target.architecture === WindowsSigning.X64 ? [] : [this.target.architecture]), WindowsSigning.UNPACKED_FOLDER_SUFFIX]
      .join("-");
    const program = path.join(this.output, folder, `${product.name}${WindowsSigning.PROGRAM_EXTENSION}`);
    if (!existsSync(program))
      throw new PackagingException(`electron-builder finished without the unpacked program ${program}, whose signature the check reads.`);
    const unpacked = (await readdir(path.join(this.output, folder), { recursive: true, withFileTypes: true }))
      .filter(t => t.isFile())
      .map(t => path.join(t.parentPath, t.name))
      .sort();
    const own = unpacked.filter(t => [WindowsSigning.PROGRAM_EXTENSION, WindowsAddonBuilder.ADDON_EXTENSION].includes(path.extname(t)));
    const libraries = unpacked.filter(t => path.extname(t) === PackageConfiguration.LIBRARY_EXTENSION);
    return new AuthenticodeCheck(this.runner, this.root, this.environment).verifyAsync([...packages, ...own], libraries, product.windowsPublisher);
  }

  public disposeAsync(): Promise<void> {
    return Promise.resolve();
  }
}
