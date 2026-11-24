/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { GitHubReleaseAsset } from "./github-release-asset.js";

export class GitHubRelease {
  public readonly tag: string | null;
  public readonly assets: readonly GitHubReleaseAsset[];

  public constructor(tag: string | null, assets: readonly GitHubReleaseAsset[]) {
    this.tag = tag;
    this.assets = assets;
  }

  public static parse(text: string): GitHubRelease {
    const json = GitHubRelease.jsonOf(text);
    if (Object.isNull(json))
      return new GitHubRelease(null, []);
    const tag = json[Resources.releaseTagField];
    const assets = json[Resources.releaseAssetsField];
    return new GitHubRelease(Object.isString(tag) ? tag : null, GitHubRelease.isList(assets) ? assets.map(t => GitHubReleaseAsset.fromValue(t)) : []);
  }

  public versionAfter(prefix: string): string {
    return !Object.isNull(this.tag) && this.tag.startsWith(prefix) ? this.tag.slice(prefix.length) : String.empty;
  }

  public assetNamed(name: string): GitHubReleaseAsset | null {
    return this.assets.find(t => t.name === name) ?? null;
  }

  private static jsonOf(text: string): JsonObject | null {
    try {
      return JsonReader.parse(text).toJson();
    }
    catch {
      return null;
    }
  }

  private static isList(value: JsonValue | undefined): value is readonly JsonValue[] {
    return Array.isArray(value);
  }
}
