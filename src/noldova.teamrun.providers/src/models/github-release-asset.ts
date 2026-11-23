/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonValue } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class GitHubReleaseAsset {
  public readonly name: string | null;
  public readonly digest: string | null;
  public readonly size: number | null;
  public readonly url: string | null;

  public constructor(name: string | null, digest: string | null, size: number | null, url: string | null) {
    this.name = name;
    this.digest = digest;
    this.size = size;
    this.url = url;
  }

  public get sha256(): string {
    return !Object.isNull(this.digest) && this.digest.startsWith(Resources.sha256DigestPrefix) ? this.digest.slice(Resources.sha256DigestPrefix.length) : String.empty;
  }

  public get knownSize(): number | null {
    return !Object.isNull(this.size) && Number.isSafeInteger(this.size) && this.size > 0 ? this.size : null;
  }

  public static fromValue(value: JsonValue): GitHubReleaseAsset {
    if (!Object.isPlainObject(value))
      return new GitHubReleaseAsset(null, null, null, null);
    const json = JsonReader.fromValue(value).toJson();
    const size = json[Resources.releaseAssetSizeField];
    return new GitHubReleaseAsset(GitHubReleaseAsset.stringOf(json[Resources.releaseAssetNameField]), GitHubReleaseAsset.stringOf(json[Resources.releaseAssetDigestField]),
      Object.isNumber(size) ? size : null, GitHubReleaseAsset.stringOf(json[Resources.releaseAssetUrlField]));
  }

  private static stringOf(value: JsonValue | undefined): string | null {
    return Object.isString(value) ? value : null;
  }
}
