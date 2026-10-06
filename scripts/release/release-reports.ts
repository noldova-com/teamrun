/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, type Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import PackageReport from "../packaging/package-report.ts";
import PackageTarget from "../packaging/package-target.ts";
import ReleaseException from "./release.exception.ts";

export default class ReleaseReports {
  public static readonly REPORT_FILE: string = "package-report.json";

  private readonly signedPlatforms: readonly string[];

  public constructor(signedPlatforms: readonly string[]) {
    this.signedPlatforms = signedPlatforms;
  }

  public async verifyAsync(folder: string): Promise<string> {
    let entries: Dirent[];
    try {
      entries = await readdir(folder, { withFileTypes: true });
    }
    catch (error) {
      throw new ReleaseException(`The package reports in ${folder} cannot be read.`, { cause: error });
    }
    const problems: string[] = [];
    const reports: PackageReport[] = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const report = entry.isDirectory() ? await ReleaseReports.readAsync(path.join(folder, entry.name, ReleaseReports.REPORT_FILE)) : null;
      if (report === null)
        problems.push(`${entry.name} holds no package report.`);
      else
        reports.push(report);
    }
    const targets = PackageTarget.listAll();
    for (const report of reports.filter(t => !targets.some(target => target.id === t.target)))
      problems.push(`A package report covers ${report.target}, which is not a target.`);
    for (const target of targets) {
      const matching = reports.filter(t => t.target === target.id);
      const isSigned = this.signedPlatforms.includes(target.platform);
      const [report] = matching;
      if (report === undefined)
        problems.push(`No package report covers ${target.id}.`);
      else if (matching.length > 1)
        problems.push(`${matching.length} package reports cover ${target.id}.`);
      else if (report.isSigned !== isSigned || report.isChecked !== isSigned)
        problems.push(`The ${target.id} package was ${ReleaseReports.describe(report)}, but the release ${isSigned ? "signs" : "does not sign"} ${target.platform} packages.`);
    }
    if (problems.length > 0)
      throw new ReleaseException(`The package reports do not match the release's signing, so nothing was published:\n${problems.join("\n")}`);
    return `Every target has one package report, and the signed ones were signed and checked: ${this.signedPlatforms.length === 0 ? "none" : this.signedPlatforms.join(", ")}.`;
  }

  private static async readAsync(file: string): Promise<PackageReport | null> {
    if (!existsSync(file))
      return null;
    const text = await readFile(file, "utf8");
    try {
      return PackageReport.parse(JSON.parse(text));
    }
    catch {
      return null;
    }
  }

  private static describe(report: PackageReport): string {
    if (report.isSigned)
      return report.isChecked ? "signed and checked" : "signed but not checked";
    return report.isChecked ? "unsigned but marked checked" : "unsigned";
  }
}
