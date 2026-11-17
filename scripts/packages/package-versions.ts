/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { PackageManifest } from "./package-manifest.ts";

export class PackageVersions {
  private static readonly VERSION_FIELD: string = "version";
  private static readonly DEPENDENCY_FIELDS: readonly string[] = ["dependencies", "peerDependencies"];
  private static readonly COMMIT_FIELD: string = "gitHead";

  public readonly version: string;
  public readonly protocolVersion: string;
  public readonly commit: string | null;

  public constructor(version: string, protocolVersion: string, commit: string | null = null) {
    this.version = version;
    this.protocolVersion = protocolVersion;
    this.commit = commit;
  }

  public stampManifest(manifest: PackageManifest, text: string): string {
    const fields = JSON.parse(text) as Readonly<Record<string, unknown>>;
    const stamped = PackageVersions.DEPENDENCY_FIELDS.filter(t => t in fields).map(field => [field, Object.fromEntries(
      Object.entries(fields[field] as Readonly<Record<string, string>>).map(([name, version]) => [name, manifest.dependencies.includes(name) ? this.version : version]))]);
    return JSON.stringify({
      ...fields,
      [PackageVersions.VERSION_FIELD]: this.version,
      ...Object.fromEntries(stamped),
      ...(this.commit === null ? {} : { [PackageVersions.COMMIT_FIELD]: this.commit })
    }, null, 2);
  }
}
