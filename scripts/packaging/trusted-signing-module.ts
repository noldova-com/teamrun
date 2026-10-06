/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type ProcessRunner from "../processes/process-runner.ts";
import ModulePackage from "./module-package.ts";
import PackagingException from "./packaging.exception.ts";

export default class TrustedSigningModule {
  public static readonly NAME: string = "TrustedSigning";
  public static readonly VERSION: string = "0.5.8";
  public static readonly GALLERY_PACKAGE: ModulePackage = new ModulePackage(
    `https://www.powershellgallery.com/api/v2/package/${TrustedSigningModule.NAME}/${TrustedSigningModule.VERSION}`,
    "h3QX13+As/6i8v7rSUhgDWg033GklH5JiVLGFV0Rl3CipfT6/0XQPqEhI2uOogGTFkxiqXOTCeQc4zTSt2v6KQ==");

  private static readonly POWERSHELL: string = "pwsh";
  private static readonly OPTIONS: readonly string[] = ["-NoProfile", "-NonInteractive", "-EncodedCommand"];
  private static readonly LIMIT: number = 300_000;
  private static readonly DOWNLOAD_LIMIT: number = 120_000;
  private static readonly HASH_ALGORITHM: string = "sha512";
  private static readonly ARCHIVE_EXTENSION: string = ".zip";
  private static readonly MANIFEST_EXTENSION: string = ".psd1";
  private static readonly ARCHIVE_VARIABLE: string = "TEAMRUN_SIGNING_ARCHIVE";
  private static readonly FOLDER_VARIABLE: string = "TEAMRUN_SIGNING_FOLDER";
  private static readonly FILE_VARIABLE: string = "TEAMRUN_SIGNING_FILE";
  private static readonly FILE_SEPARATOR: string = ",";
  private static readonly CREDENTIALS: readonly string[] = ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET"];
  private static readonly ENDPOINT: string = "https://wus3.codesigning.azure.net/";
  private static readonly ACCOUNT_NAME: string = "noldova-signing";
  private static readonly CERTIFICATE_PROFILE: string = "TeamRun";
  private static readonly TIMESTAMP_SERVER: string = "http://timestamp.acs.microsoft.com";
  private static readonly DIGEST: string = "SHA256";
  private static readonly LINE_SEPARATOR: string = "\n";
  private static readonly EXPAND_SCRIPT: string = [
    "$ErrorActionPreference = 'Stop'",
    `Microsoft.PowerShell.Archive\\Expand-Archive -LiteralPath $env:${TrustedSigningModule.ARCHIVE_VARIABLE} -DestinationPath $env:${TrustedSigningModule.FOLDER_VARIABLE}`,
    `Microsoft.PowerShell.Core\\Import-Module (Microsoft.PowerShell.Management\\Join-Path $env:${TrustedSigningModule.FOLDER_VARIABLE} '${TrustedSigningModule.NAME}${TrustedSigningModule.MANIFEST_EXTENSION}')`,
    `$module = Microsoft.PowerShell.Core\\Get-Module -Name ${TrustedSigningModule.NAME}`,
    `if ($module.Version -ne [version]'${TrustedSigningModule.VERSION}') { throw "${TrustedSigningModule.NAME} $($module.Version) loaded instead of ${TrustedSigningModule.VERSION}." }`
  ].join(TrustedSigningModule.LINE_SEPARATOR);
  private static readonly SIGN_SCRIPT: string = [
    "$ErrorActionPreference = 'Stop'",
    `Microsoft.PowerShell.Core\\Import-Module (Microsoft.PowerShell.Management\\Join-Path $env:${TrustedSigningModule.FOLDER_VARIABLE} '${TrustedSigningModule.NAME}${TrustedSigningModule.MANIFEST_EXTENSION}')`,
    `${TrustedSigningModule.NAME}\\Invoke-TrustedSigning -Endpoint '${TrustedSigningModule.ENDPOINT}' -CodeSigningAccountName '${TrustedSigningModule.ACCOUNT_NAME}' `
      + `-CertificateProfileName '${TrustedSigningModule.CERTIFICATE_PROFILE}' -FileDigest '${TrustedSigningModule.DIGEST}' `
      + `-TimestampRfc3161 '${TrustedSigningModule.TIMESTAMP_SERVER}' -TimestampDigest '${TrustedSigningModule.DIGEST}' -Files $env:${TrustedSigningModule.FILE_VARIABLE}`
  ].join(TrustedSigningModule.LINE_SEPARATOR);

  private readonly runner: ProcessRunner;
  private readonly folder: string;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(runner: ProcessRunner, folder: string, environment: NodeJS.ProcessEnv) {
    this.runner = runner;
    this.folder = folder;
    this.environment = environment;
  }

  public static fromEnvironment(runner: ProcessRunner, environment: NodeJS.ProcessEnv): TrustedSigningModule {
    const folder = environment[TrustedSigningModule.FOLDER_VARIABLE] ?? "";
    if (!path.isAbsolute(folder))
      throw new PackagingException(`${TrustedSigningModule.FOLDER_VARIABLE} must name the folder that holds the prepared ${TrustedSigningModule.NAME} module, not "${folder}".`);
    return new TrustedSigningModule(runner, folder, environment);
  }

  public describeEnvironment(): NodeJS.ProcessEnv {
    const missing = TrustedSigningModule.CREDENTIALS.filter(t => (this.environment[t] ?? "").length === 0);
    if (missing.length > 0)
      throw new PackagingException(`Signing Windows packages needs ${missing.join(", ")}, the Azure service principal that signs with ${TrustedSigningModule.ACCOUNT_NAME}.`);
    return { ...Object.fromEntries(TrustedSigningModule.CREDENTIALS.map(t => [t, this.environment[t]])), [TrustedSigningModule.FOLDER_VARIABLE]: this.folder };
  }

  public async prepareAsync(source: ModulePackage): Promise<void> {
    const bytes = await TrustedSigningModule.downloadAsync(source.url);
    const hash = createHash(TrustedSigningModule.HASH_ALGORITHM).update(bytes).digest("base64");
    if (hash !== source.sha512)
      throw new PackagingException(`The ${TrustedSigningModule.NAME} ${TrustedSigningModule.VERSION} package from ${source.url} has the SHA-512 ${hash}, not the recorded ${source.sha512}, so it was not expanded.`);
    await rm(this.folder, { recursive: true, force: true });
    await mkdir(this.folder, { recursive: true });
    const archive = path.join(path.dirname(this.folder), `${TrustedSigningModule.NAME}.${TrustedSigningModule.VERSION}${TrustedSigningModule.ARCHIVE_EXTENSION}`);
    await writeFile(archive, bytes);
    try {
      await this.runAsync(TrustedSigningModule.EXPAND_SCRIPT, { [TrustedSigningModule.ARCHIVE_VARIABLE]: archive }, path.dirname(this.folder), "expanding and loading");
    }
    finally {
      await rm(archive, { force: true });
    }
  }

  public async signAsync(file: string): Promise<void> {
    if (file.includes(TrustedSigningModule.FILE_SEPARATOR))
      throw new PackagingException(`${TrustedSigningModule.NAME} takes a comma-separated list of files, so it cannot sign ${file}.`);
    await this.runAsync(TrustedSigningModule.SIGN_SCRIPT, { [TrustedSigningModule.FILE_VARIABLE]: path.resolve(file) }, path.dirname(path.resolve(file)), `signing ${file} with`);
  }

  private static async downloadAsync(url: string): Promise<Buffer> {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(TrustedSigningModule.DOWNLOAD_LIMIT) });
    }
    catch (error) {
      throw new PackagingException(`The ${TrustedSigningModule.NAME} package could not be downloaded from ${url}: ${String(error)}`, { cause: error });
    }
    if (!response.ok)
      throw new PackagingException(`The ${TrustedSigningModule.NAME} package could not be downloaded from ${url}: HTTP ${response.status}.`);
    return Buffer.from(await response.arrayBuffer());
  }

  private async runAsync(script: string, variables: NodeJS.ProcessEnv, directory: string, action: string): Promise<void> {
    const command = Buffer.from(script, "utf16le").toString("base64");
    const result = await this.runner.captureAsync(TrustedSigningModule.POWERSHELL, [...TrustedSigningModule.OPTIONS, command], directory, TrustedSigningModule.LIMIT,
      { ...this.environment, [TrustedSigningModule.FOLDER_VARIABLE]: this.folder, ...variables });
    if (!result.isSuccessful)
      throw new PackagingException(`${TrustedSigningModule.POWERSHELL} failed ${action} the ${TrustedSigningModule.NAME} module with exit code ${result.exitCode}:\n${result.text}`);
  }
}
