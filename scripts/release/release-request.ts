/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReleaseException from "./release.exception.ts";
import ReleaseVersion from "./release-version.ts";

export default class ReleaseRequest {
  private static readonly REPOSITORY_VARIABLE: string = "RELEASE_REPOSITORY";
  private static readonly VERSION_VARIABLE: string = "RELEASE_VERSION";
  private static readonly REVISION_VARIABLE: string = "RELEASE_REVISION";
  private static readonly REPOSITORY_PATTERN: RegExp = /^[A-Za-z0-9-]+\/(?!\.+$)[A-Za-z0-9._-]+$/u;
  private static readonly REVISION_PATTERN: RegExp = /^[0-9a-f]{40}$/u;

  public readonly repository: string;
  public readonly version: ReleaseVersion;
  public readonly revision: string;

  private constructor(repository: string, version: ReleaseVersion, revision: string) {
    this.repository = repository;
    this.version = version;
    this.revision = revision;
  }

  public static read(environment: NodeJS.ProcessEnv): ReleaseRequest {
    const repository = environment[ReleaseRequest.REPOSITORY_VARIABLE] ?? "";
    if (!ReleaseRequest.REPOSITORY_PATTERN.test(repository))
      throw new ReleaseException(`${ReleaseRequest.REPOSITORY_VARIABLE} must name a repository as owner/name, not "${repository}".`);
    const version = ReleaseVersion.parse(environment[ReleaseRequest.VERSION_VARIABLE] ?? "", ReleaseRequest.VERSION_VARIABLE);
    const revision = environment[ReleaseRequest.REVISION_VARIABLE] ?? "";
    if (!ReleaseRequest.REVISION_PATTERN.test(revision))
      throw new ReleaseException(`${ReleaseRequest.REVISION_VARIABLE} must be a full commit SHA of 40 lowercase hexadecimal digits, not "${revision}".`);
    return new ReleaseRequest(repository, version, revision);
  }
}
