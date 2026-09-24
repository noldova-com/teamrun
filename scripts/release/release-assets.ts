/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { copyFile, lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import PackageException from "../packaging/package.exception.ts";
import ReleaseCandidate from "./release-candidate.ts";
import ReleaseFile from "./release-file.ts";

export default class ReleaseAssets {
  private static readonly PLATFORMS: readonly string[] = ["windows", "mac", "linux"];
  private static readonly ARCHITECTURES: readonly string[] = ["x64", "arm64"];
  private static readonly CHECKSUMS_FILE: string = "SHA256SUMS";
  private static readonly REPORT_PATTERN: RegExp = /^package-report-(windows|mac|linux)-(x64|arm64)\.json$/;
  private static readonly BUILDER_METADATA_FILES: readonly string[] = [
    "latest.yml", "latest-mac.yml", "latest-linux.yml", "latest-linux-arm64.yml"
  ];
  private static readonly TARGETS_REQUIRED: string = "Release requires exactly six build artifacts.";
  private static readonly STAGING_NOT_EMPTY: string = "Release staging must be empty.";
  private static readonly INVALID_INPUT: string = "Release input must contain artifact directories.";
  private static readonly REPORT_REQUIRED: string = "Each artifact must contain one package report.";
  private static readonly REPORT_MISMATCH: string = "The package report does not match the unsigned native release candidate.";
  private static readonly DUPLICATE_TARGET: string = "Duplicate target or mismatched package report name.";
  private static readonly INVALID_PAYLOAD: string = "Invalid or duplicated release payload in package report.";
  private static readonly MISSING_UPDATE: string = "Missing update payload.";
  private static readonly INVALID_FILES: string = "Missing required payloads or unexpected files in build artifact.";

  private readonly candidate: ReleaseCandidate;

  public constructor(candidate: ReleaseCandidate) {
    this.candidate = candidate;
  }

  public async prepare(input: string, output: string): Promise<readonly ReleaseFile[]> {
    const files: ReleaseFile[] = [];
    const targets = new Set<string>();
    const directories = await readdir(input);
    if (directories.length !== ReleaseAssets.PLATFORMS.length * ReleaseAssets.ARCHITECTURES.length)
      throw new PackageException(ReleaseAssets.TARGETS_REQUIRED);
    await mkdir(output, { recursive: true });
    if ((await readdir(output)).length !== 0)
      throw new PackageException(ReleaseAssets.STAGING_NOT_EMPTY);
    for (const directory of directories) {
      const source = path.join(input, directory);
      if (!(await lstat(source)).isDirectory())
        throw new PackageException(ReleaseAssets.INVALID_INPUT);
      const names = await readdir(source);
      const reports = names.filter(t => ReleaseAssets.REPORT_PATTERN.test(t));
      const reportName = reports[0];
      if (reports.length !== 1 || reportName === undefined)
        throw new PackageException(ReleaseAssets.REPORT_REQUIRED);
      const reportFile = await ReleaseFile.read(path.join(source, reportName));
      const report: unknown = JSON.parse(await readFile(reportFile.path, "utf8"));
      if (typeof report !== "object" || report === null || !("version" in report) || report.version !== this.candidate.version.value
        || !("sourceRevision" in report) || report.sourceRevision !== this.candidate.revision
        || !("targetPlatform" in report) || typeof report.targetPlatform !== "string" || !ReleaseAssets.PLATFORMS.includes(report.targetPlatform)
        || !("targetArchitecture" in report) || typeof report.targetArchitecture !== "string" || !ReleaseAssets.ARCHITECTURES.includes(report.targetArchitecture)
        || !("hostArchitecture" in report) || report.hostArchitecture !== report.targetArchitecture
        || !("hostPlatform" in report) || report.hostPlatform !== (report.targetPlatform === "windows" ? "win32" : report.targetPlatform === "mac" ? "darwin" : "linux")
        || !("signingRequested" in report) || report.signingRequested !== false || !("files" in report) || !Array.isArray(report.files))
        throw new PackageException(ReleaseAssets.REPORT_MISMATCH);
      const target = `${report.targetPlatform}-${report.targetArchitecture}`;
      if (targets.has(target) || reportName !== `package-report-${target}.json`)
        throw new PackageException(ReleaseAssets.DUPLICATE_TARGET);
      targets.add(target);
      const prefix = `TeamRun-${this.candidate.version.value}-${target}`;
      const required = report.targetPlatform === "windows" ? [`${prefix}-setup.exe`, `${prefix}.zip`] :
        report.targetPlatform === "mac" ? [`${prefix}.dmg`, `${prefix}.zip`] : [`${prefix}.AppImage`];
      const reported = new Set<string>();
      const payloads = new Map<string, ReleaseFile>();
      const entries: readonly unknown[] = report.files;
      for (const entry of entries) {
        if (typeof entry !== "object" || entry === null || !("name" in entry) || typeof entry.name !== "string"
          || ![...required, ...required.map(t => `${t}.blockmap`), ...ReleaseAssets.BUILDER_METADATA_FILES].includes(entry.name)
          || reported.has(entry.name) || !("size" in entry) || !("sha256" in entry))
          throw new PackageException(ReleaseAssets.INVALID_PAYLOAD);
        const file = await ReleaseFile.read(path.join(source, entry.name));
        if (file.size !== entry.size || file.sha256 !== entry.sha256)
          throw new PackageException(`Release payload does not match its package report: ${file.name}`);
        reported.add(entry.name);
        if (!entry.name.endsWith(".yml")) {
          payloads.set(entry.name, file);
          files.push(await this.copy(file, output));
        }
      }
      const updateName = report.targetPlatform === "windows" ? `${prefix}-setup.exe` : report.targetPlatform === "mac" ? `${prefix}.zip` : `${prefix}.AppImage`;
      const update = payloads.get(updateName);
      if (!update)
        throw new PackageException(ReleaseAssets.MISSING_UPDATE);
      if (required.some(t => !reported.has(t)) || names.some(t => t !== reportName && !reported.has(t)))
        throw new PackageException(ReleaseAssets.INVALID_FILES);
      files.push(await this.copy(reportFile, output));
      const url = `https://github.com/${ReleaseCandidate.REPOSITORY}/releases/download/${this.candidate.tag}/${update.name}`;
      const metadata = JSON.stringify({ version: this.candidate.version.value, files: [{ url, sha512: update.sha512, size: update.size }],
        path: url, sha512: update.sha512 }, null, 2) + "\n";
      const metadataNames = [`latest-${target}.yml`];
      if (target === "windows-x64")
        metadataNames.push("latest.yml");
      for (const name of metadataNames) {
        const filename = path.join(output, name);
        await writeFile(filename, metadata, { flag: "wx" });
        files.push(await ReleaseFile.read(filename));
      }
    }
    files.sort((first, second) => first.name < second.name ? -1 : 1);
    const checksums = path.join(output, ReleaseAssets.CHECKSUMS_FILE);
    await writeFile(checksums, files.map(t => `${t.sha256}  ${t.name}\n`).join(""), { flag: "wx" });
    files.push(await ReleaseFile.read(checksums));
    return files;
  }

  private async copy(file: ReleaseFile, output: string): Promise<ReleaseFile> {
    const filename = path.join(output, file.name);
    await copyFile(file.path, filename);
    return ReleaseFile.read(filename);
  }
}
