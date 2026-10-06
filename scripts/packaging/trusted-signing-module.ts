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
import PackagingException from "./packaging.exception.ts";
import PinnedPackage from "./pinned-package.ts";

export default class TrustedSigningModule {
  public static readonly NAME: string = "TrustedSigning";
  public static readonly VERSION: string = "0.5.8";

  private static readonly CREDENTIALS: readonly string[] = ["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET"];
  private static readonly MODULE_FOLDER: string = "module";
  private static readonly TOOLS_FOLDER: string = "tools";
  private static readonly TOOLS_VARIABLE: string = "LOCALAPPDATA";
  private static readonly NUGET: string = "https://api.nuget.org/v3-flatcontainer";
  private static readonly NUGET_EXTENSION: string = ".nupkg";
  private static readonly FOLDER_SEPARATOR: string = "/";
  private static readonly POWERSHELL: string = "pwsh";
  private static readonly OPTIONS: readonly string[] = ["-NoProfile", "-NonInteractive", "-EncodedCommand"];
  private static readonly LIMIT: number = 300_000;
  private static readonly DOWNLOAD_LIMIT: number = 120_000;
  private static readonly HASH_ALGORITHM: string = "sha512";
  private static readonly ARCHIVE_EXTENSION: string = ".zip";
  private static readonly MANIFEST_EXTENSION: string = ".psd1";
  private static readonly ARCHIVES_VARIABLE: string = "TEAMRUN_SIGNING_ARCHIVES";
  private static readonly DESTINATIONS_VARIABLE: string = "TEAMRUN_SIGNING_DESTINATIONS";
  private static readonly FOLDER_VARIABLE: string = "TEAMRUN_SIGNING_FOLDER";
  private static readonly FILE_VARIABLE: string = "TEAMRUN_SIGNING_FILE";
  private static readonly FILE_SEPARATOR: string = ",";
  private static readonly ENDPOINT: string = "https://wus3.codesigning.azure.net/";
  private static readonly ACCOUNT_NAME: string = "noldova-signing";
  private static readonly CERTIFICATE_PROFILE: string = "TeamRun";
  private static readonly TIMESTAMP_SERVER: string = "http://timestamp.acs.microsoft.com";
  private static readonly DIGEST: string = "SHA256";
  private static readonly LINE_SEPARATOR: string = "\n";
  private static readonly IMPORT_LINE: string = `Microsoft.PowerShell.Core\\Import-Module (Microsoft.PowerShell.Management\\Join-Path $env:${TrustedSigningModule.FOLDER_VARIABLE} `
    + `'${TrustedSigningModule.MODULE_FOLDER}' '${TrustedSigningModule.NAME}${TrustedSigningModule.MANIFEST_EXTENSION}')`;
  private static readonly EXPAND_SCRIPT: string = [
    "$ErrorActionPreference = 'Stop'",
    `$archives = $env:${TrustedSigningModule.ARCHIVES_VARIABLE}.Split([char]10)`,
    `$destinations = $env:${TrustedSigningModule.DESTINATIONS_VARIABLE}.Split([char]10)`,
    "for ($index = 0; $index -lt $archives.Count; $index++) { Microsoft.PowerShell.Archive\\Expand-Archive -LiteralPath $archives[$index] -DestinationPath $destinations[$index] }",
    TrustedSigningModule.IMPORT_LINE,
    `$module = Microsoft.PowerShell.Core\\Get-Module -Name ${TrustedSigningModule.NAME}`,
    `if ($module.Version -ne [version]'${TrustedSigningModule.VERSION}') { throw "${TrustedSigningModule.NAME} $($module.Version) loaded instead of ${TrustedSigningModule.VERSION}." }`
  ].join(TrustedSigningModule.LINE_SEPARATOR);
  private static readonly SIGN_SCRIPT: string = [
    "$ErrorActionPreference = 'Stop'",
    TrustedSigningModule.IMPORT_LINE,
    `${TrustedSigningModule.NAME}\\Invoke-TrustedSigning -Endpoint '${TrustedSigningModule.ENDPOINT}' -CodeSigningAccountName '${TrustedSigningModule.ACCOUNT_NAME}' `
      + `-CertificateProfileName '${TrustedSigningModule.CERTIFICATE_PROFILE}' -FileDigest '${TrustedSigningModule.DIGEST}' `
      + `-TimestampRfc3161 '${TrustedSigningModule.TIMESTAMP_SERVER}' -TimestampDigest '${TrustedSigningModule.DIGEST}' -Files $env:${TrustedSigningModule.FILE_VARIABLE}`
  ].join(TrustedSigningModule.LINE_SEPARATOR);

  public static readonly PACKAGES: readonly PinnedPackage[] = [
    new PinnedPackage(`https://www.powershellgallery.com/api/v2/package/${TrustedSigningModule.NAME}/${TrustedSigningModule.VERSION}`,
      "h3QX13+As/6i8v7rSUhgDWg033GklH5JiVLGFV0Rl3CipfT6/0XQPqEhI2uOogGTFkxiqXOTCeQc4zTSt2v6KQ==", TrustedSigningModule.MODULE_FOLDER),
    TrustedSigningModule.createTool("Microsoft.Windows.SDK.BuildTools", "10.0.26100.4188",
      "OkiRhdDr0ngD6+wm0Ezdu1mgV8ZuknXdHwjzeHVZjYSXi9bCkYkq9Ns/X/ab9BoHb+Tq/5/RmXbdNWtC0qHipQ=="),
    TrustedSigningModule.createTool("Microsoft.Trusted.Signing.Client", "1.0.95",
      "uTRnbWSg1agZUh8J5bqJXhJr4LZ9dzs6Xy9PNxK4yA9ubpGuPq71bz1AZMmiKs/HVbQc3NUChtGMVexqmuV+kA=="),
    TrustedSigningModule.createTool("sign", "0.9.1-beta.24469.1",
      "JftL2Fv9TwqfQdxh3Sjq/iqPb8lWEIMgDfa32KCXFqkebD1iadk10eRTjagVQgoxxRQiOp39eCd0ufs5cPD93A==")
  ];

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

  public static takeCredentials(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const credentials = Object.fromEntries(TrustedSigningModule.CREDENTIALS.filter(t => environment[t] !== undefined).map(t => [t, environment[t]]));
    for (const name of TrustedSigningModule.CREDENTIALS)
      Reflect.deleteProperty(environment, name);
    return credentials;
  }

  public describeEnvironment(credentials: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const missing = TrustedSigningModule.CREDENTIALS.filter(t => (credentials[t] ?? "").length === 0);
    if (missing.length > 0)
      throw new PackagingException(`Signing Windows packages needs ${missing.join(", ")}, the Azure service principal that signs with ${TrustedSigningModule.ACCOUNT_NAME}.`);
    return { ...Object.fromEntries(TrustedSigningModule.CREDENTIALS.map(t => [t, credentials[t]])), [TrustedSigningModule.FOLDER_VARIABLE]: this.folder };
  }

  public async prepareAsync(sources: readonly PinnedPackage[]): Promise<void> {
    const downloads: (readonly [archive: string, destination: string, bytes: Buffer])[] = [];
    for (const source of sources) {
      const bytes = await TrustedSigningModule.downloadAsync(source.url);
      const hash = createHash(TrustedSigningModule.HASH_ALGORITHM).update(bytes).digest("base64");
      if (hash !== source.sha512)
        throw new PackagingException(`The package from ${source.url} has the SHA-512 ${hash}, not the recorded ${source.sha512}, so no signing package was expanded.`);
      downloads.push([path.join(this.folder, `${path.basename(source.folder)}${TrustedSigningModule.ARCHIVE_EXTENSION}`),
        path.join(this.folder, ...source.folder.split(TrustedSigningModule.FOLDER_SEPARATOR)), bytes]);
    }
    await rm(this.folder, { recursive: true, force: true });
    await mkdir(this.folder, { recursive: true });
    try {
      for (const [archive, , bytes] of downloads)
        await writeFile(archive, bytes);
      await this.runAsync(TrustedSigningModule.EXPAND_SCRIPT, {
        [TrustedSigningModule.ARCHIVES_VARIABLE]: downloads.map(([archive]) => archive).join(TrustedSigningModule.LINE_SEPARATOR),
        [TrustedSigningModule.DESTINATIONS_VARIABLE]: downloads.map(([, destination]) => destination).join(TrustedSigningModule.LINE_SEPARATOR)
      }, this.folder, "expanding and loading");
    }
    finally {
      await Promise.all(downloads.map(([archive]) => rm(archive, { force: true })));
    }
  }

  public async signAsync(file: string): Promise<void> {
    if (file.includes(TrustedSigningModule.FILE_SEPARATOR))
      throw new PackagingException(`${TrustedSigningModule.NAME} takes a comma-separated list of files, so it cannot sign ${file}.`);
    await this.runAsync(TrustedSigningModule.SIGN_SCRIPT, {
      [TrustedSigningModule.FILE_VARIABLE]: path.resolve(file),
      [TrustedSigningModule.TOOLS_VARIABLE]: path.join(this.folder, TrustedSigningModule.TOOLS_FOLDER)
    }, path.dirname(path.resolve(file)), `signing ${file} with`);
  }

  private static createTool(name: string, version: string, sha512: string): PinnedPackage {
    const id = name.toLowerCase();
    const release = version.toLowerCase();
    return new PinnedPackage(`${TrustedSigningModule.NUGET}/${id}/${release}/${id}.${release}${TrustedSigningModule.NUGET_EXTENSION}`, sha512,
      [TrustedSigningModule.TOOLS_FOLDER, TrustedSigningModule.NAME, name, `${name}.${version}`].join(TrustedSigningModule.FOLDER_SEPARATOR));
  }

  private static async downloadAsync(url: string): Promise<Buffer> {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(TrustedSigningModule.DOWNLOAD_LIMIT) });
    }
    catch (error) {
      throw new PackagingException(`A signing package could not be downloaded from ${url}: ${String(error)}`, { cause: error });
    }
    if (!response.ok)
      throw new PackagingException(`A signing package could not be downloaded from ${url}: HTTP ${response.status}.`);
    return Buffer.from(await response.arrayBuffer());
  }

  private async runAsync(script: string, variables: NodeJS.ProcessEnv, directory: string, action: string): Promise<void> {
    const command = Buffer.from(script, "utf16le").toString("base64");
    const names = new Set(Object.keys(variables).map(t => t.toUpperCase()));
    const inherited = Object.fromEntries(Object.entries(this.environment).filter(([name]) => !names.has(name.toUpperCase())));
    const result = await this.runner.captureAsync(TrustedSigningModule.POWERSHELL, [...TrustedSigningModule.OPTIONS, command], directory, TrustedSigningModule.LIMIT,
      { ...inherited, [TrustedSigningModule.FOLDER_VARIABLE]: this.folder, ...variables });
    if (!result.isSuccessful)
      throw new PackagingException(`${TrustedSigningModule.POWERSHELL} failed ${action} the ${TrustedSigningModule.NAME} module with exit code ${result.exitCode}:\n${result.text}`);
  }
}
