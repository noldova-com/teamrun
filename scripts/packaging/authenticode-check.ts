/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ProcessRunner from "../processes/process-runner.ts";
import PackagingException from "./packaging.exception.ts";

export default class AuthenticodeCheck {
  private static readonly POWERSHELL: string = "pwsh";
  private static readonly OPTIONS: readonly string[] = ["-NoProfile", "-NonInteractive", "-EncodedCommand"];
  private static readonly FILES_VARIABLE: string = "TEAMRUN_SIGNED_FILES";
  private static readonly LIBRARIES_VARIABLE: string = "TEAMRUN_SIGNED_LIBRARIES";
  private static readonly PUBLISHER_VARIABLE: string = "TEAMRUN_WINDOWS_PUBLISHER";
  private static readonly SEPARATOR: string = "\n";
  private static readonly LIMIT: number = 120_000;
  private static readonly SCRIPT: string = [
    "$ErrorActionPreference = 'Stop'",
    "$flags = [System.Security.Cryptography.X509Certificates.X500DistinguishedNameFlags]::UseNewLines",
    "function Get-Fields($name) { @($name.Decode($flags).Split([char]10) | Microsoft.PowerShell.Core\\ForEach-Object { $_.Trim() } | Microsoft.PowerShell.Core\\Where-Object { $_ }) }",
    `$publisher = Get-Fields ([System.Security.Cryptography.X509Certificates.X500DistinguishedName]::new($env:${AuthenticodeCheck.PUBLISHER_VARIABLE}))`,
    "$failed = $false",
    `$libraries = @(if ($env:${AuthenticodeCheck.LIBRARIES_VARIABLE}) { $env:${AuthenticodeCheck.LIBRARIES_VARIABLE}.Split([char]10) })`,
    `foreach ($file in @($env:${AuthenticodeCheck.FILES_VARIABLE}.Split([char]10)) + $libraries) {`,
    "  $signature = Microsoft.PowerShell.Security\\Get-AuthenticodeSignature -LiteralPath $file",
    "  $subject = if ($null -eq $signature.SignerCertificate) { @() } else { Get-Fields $signature.SignerCertificate.SubjectName }",
    "  $published = $subject.Count -gt 0 -and @($publisher | Microsoft.PowerShell.Core\\Where-Object { $subject -cnotcontains $_ }).Count -eq 0",
    "  $microsoft = $libraries -ccontains $file -and $subject -ccontains 'O=Microsoft Corporation'",
    "  $timestamped = $null -ne $signature.TimeStamperCertificate",
    "  \"${file}: $($signature.Status), timestamped: $timestamped, publisher matches: $published, signer: $($signature.SignerCertificate.Subject)\"",
    "  if ($signature.Status -ne 'Valid' -or -not $timestamped -or -not ($published -or $microsoft)) { $failed = $true }",
    "}",
    "if ($failed) { exit 1 }"
  ].join(AuthenticodeCheck.SEPARATOR);

  private readonly runner: ProcessRunner;
  private readonly folder: string;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(runner: ProcessRunner, folder: string, environment: NodeJS.ProcessEnv) {
    this.runner = runner;
    this.folder = folder;
    this.environment = environment;
  }

  public async verifyAsync(files: readonly string[], libraries: readonly string[], publisher: string): Promise<string> {
    const command = Buffer.from(AuthenticodeCheck.SCRIPT, "utf16le").toString("base64");
    const result = await this.runner.captureAsync(AuthenticodeCheck.POWERSHELL, [...AuthenticodeCheck.OPTIONS, command], this.folder, AuthenticodeCheck.LIMIT,
      {
        ...this.environment,
        [AuthenticodeCheck.FILES_VARIABLE]: files.join(AuthenticodeCheck.SEPARATOR),
        [AuthenticodeCheck.LIBRARIES_VARIABLE]: libraries.join(AuthenticodeCheck.SEPARATOR),
        [AuthenticodeCheck.PUBLISHER_VARIABLE]: publisher
      });
    if (!result.isSuccessful)
      throw new PackagingException(`Not every program and addon is signed by ${publisher}, and every library by it or Microsoft, with a valid, timestamped signature; ${AuthenticodeCheck.POWERSHELL} exited with ${result.exitCode}:\n${result.text}`);
    return result.output.trim();
  }
}
