/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ProductIdentity from "../packages/product-identity.ts";
import PackageTarget from "../packaging/package-target.ts";
import ReleaseException from "./release.exception.ts";
import type ReleaseVersion from "./release-version.ts";

export default class ReleaseNotes {
  private static readonly RUN_VARIABLE: string = "RELEASE_RUN_URL";
  private static readonly SECURE_PROTOCOL: string = "https:";
  private static readonly PARAGRAPH: string = "\n\n";
  private static readonly PLATFORM_NAMES: ReadonlyMap<string, string> = new Map([
    [PackageTarget.WINDOWS, "Windows"], [PackageTarget.MACOS, "macOS"], [PackageTarget.LINUX, "Linux"]
  ]);
  private static readonly ARCHITECTURE_NAMES: ReadonlyMap<string, string> = new Map([["x64", "x64"], ["arm64", "ARM64"]]);

  public static compose(product: ProductIdentity, supported: readonly PackageTarget[], repository: string, version: ReleaseVersion, runUrl: string): string {
    if (!URL.canParse(runUrl) || new URL(runUrl).protocol !== ReleaseNotes.SECURE_PROTOCOL)
      throw new ReleaseException(`${ReleaseNotes.RUN_VARIABLE} must be the https address of the run that built the release, not "${runUrl}".`);
    const name = product.name;
    const ciOnly = PackageTarget.listAll().filter(t => !supported.some(s => s.id === t.id));
    const paragraphs = [
      `${name} ${version.text} for Windows, Linux and macOS, each on x64 and ARM64. Its packages are unsigned.`,
      supported.length === 0
        ? "No target has passed its native acceptance yet, so every target was accepted by a CI run only."
        : `Supported after their native acceptance: ${ReleaseNotes.formatTargets(supported)}.`
        + (ciOnly.length === 0 ? "" : ` Accepted by a CI run only: ${ReleaseNotes.formatTargets(ciOnly)}.`),
      `Each target's package passed its install check on that target's own runner in the run that built it: ${runUrl}`
    ];
    if (!product.isReleaseRepository(repository))
      paragraphs.unshift(`Unsigned test release of ${name}, published in ${repository}; an installed ${name} never updates from it.`);
    return paragraphs.join(ReleaseNotes.PARAGRAPH);
  }

  private static formatTargets(targets: readonly PackageTarget[]): string {
    return targets.map(t => `${ReleaseNotes.PLATFORM_NAMES.get(t.platform)} ${ReleaseNotes.ARCHITECTURE_NAMES.get(t.architecture)}`).join(", ");
  }
}
