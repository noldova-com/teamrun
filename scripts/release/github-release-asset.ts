/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import GitHubJson from "../repository/github-json.ts";

export default class GitHubReleaseAsset {
  private static readonly UPLOADED_STATE: string = "uploaded";

  public readonly id: number;
  public readonly name: string;
  public readonly size: number;
  public readonly isUploaded: boolean;
  public readonly digest: string | null;

  private constructor(id: number, name: string, size: number, isUploaded: boolean, digest: string | null) {
    this.id = id;
    this.name = name;
    this.size = size;
    this.isUploaded = isUploaded;
    this.digest = digest;
  }

  public static read(value: unknown, context: string): GitHubReleaseAsset {
    const asset = GitHubJson.object(value, context);
    return new GitHubReleaseAsset(GitHubJson.number(asset, "id", context), GitHubJson.text(asset, "name", context), GitHubJson.number(asset, "size", context),
      GitHubJson.text(asset, "state", context) === GitHubReleaseAsset.UPLOADED_STATE, GitHubJson.nullableText(asset, "digest", context));
  }
}
