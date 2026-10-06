/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";
import timers from "node:timers/promises";

import type GitHubApi from "../repository/github-api.ts";
import ProcessTimeoutException from "../processes/process-timeout.exception.ts";
import GitHubException from "../repository/github.exception.ts";
import GitHubJson from "../repository/github-json.ts";
import GitHubRelease from "./github-release.ts";
import type GitHubReleaseAsset from "./github-release-asset.ts";
import type PackageDigest from "./package-digest.ts";
import ReleaseException from "./release.exception.ts";
import type ReleaseFile from "./release-file.ts";
import type ReleaseVersion from "./release-version.ts";

export default class ReleasePublisher {
  private static readonly ATTEMPTS: number = 3;
  private static readonly RETRY_PAUSE: number = 10_000;
  private static readonly DIGEST_PREFIX: string = "sha256:";
  private static readonly RETRIED_STATUSES: readonly number[] = [408, 429];
  private static readonly SERVER_ERROR: number = 500;
  private static readonly EXISTING_REFERENCE: number = 422;
  private static readonly COMMIT_TYPE: string = "commit";
  private static readonly LATEST: string = "true";
  private static readonly TAG_PREFIX: string = "refs/tags/";

  private readonly api: GitHubApi;
  private readonly output: Writable;

  public constructor(api: GitHubApi, output: Writable) {
    this.api = api;
    this.output = output;
  }

  private static isTransient(error: unknown): error is GitHubException | ProcessTimeoutException {
    return error instanceof ProcessTimeoutException || (error instanceof GitHubException
      && (error.status === null || error.status >= ReleasePublisher.SERVER_ERROR || ReleasePublisher.RETRIED_STATUSES.includes(error.status)));
  }

  private static requireSame(asset: GitHubReleaseAsset, digest: PackageDigest): void {
    const expected = `${ReleasePublisher.DIGEST_PREFIX}${digest.sha256}`;
    if (asset.digest !== expected || asset.size !== digest.size)
      throw new ReleaseException(`${asset.name} on GitHub has ${asset.size} bytes and ${asset.digest ?? "no digest"}, but the built file has ${digest.size} bytes and ${expected}. `
        + "A release's files are never replaced.");
  }

  private static requireComplete(release: GitHubRelease, digests: ReadonlyMap<string, PackageDigest>): void {
    const missing: string[] = [];
    for (const [name, digest] of digests) {
      const asset = release.assets.find(t => t.name === name);
      if (asset === undefined || !asset.isUploaded)
        missing.push(name);
      else
        ReleasePublisher.requireSame(asset, digest);
    }
    const unexpected = release.assets.filter(t => !digests.has(t.name)).map(t => t.name);
    if (missing.length > 0 || unexpected.length > 0)
      throw new ReleaseException(`${release.tag} on GitHub differs from the built files. Missing: ${missing.join(", ") || "none"}. Not part of the release: ${unexpected.join(", ") || "none"}.`);
  }

  public async publishAsync(version: ReleaseVersion, revision: string, folder: string, files: readonly ReleaseFile[], notes: string): Promise<void> {
    const digests = new Map(files.map(t => [t.name, t.digest]));
    const releases = (await this.api.readPagesAsync("/releases")).map((t, index) => GitHubRelease.read(t, `releases[${index}]`)).filter(t => t.tag === version.tag);
    if (releases.length > 1)
      throw new ReleaseException(`${releases.length} releases use the tag ${version.tag}; delete all but one by hand before publishing.`);
    const existing = releases.at(0);
    if (existing !== undefined && !existing.isDraft) {
      ReleasePublisher.requireComplete(existing, digests);
      await this.requireTagAsync(version.tag, revision);
      this.output.write(`${version.tag} is already published with every file as built; nothing changed.\n`);
      return;
    }

    const draft = existing ?? await this.createDraftAsync(version, revision, notes);
    if (draft.target !== revision)
      throw new ReleaseException(`The draft release ${version.tag} is for ${draft.target}, not for ${revision}; delete the draft by hand to publish ${revision}.`);
    for (const [name, digest] of digests)
      await this.uploadAsync(draft, name, path.join(folder, name), digest);
    ReleasePublisher.requireComplete(await this.readAsync(draft.id), digests);
    await this.createTagAsync(version.tag, revision);
    const published = GitHubRelease.read(await this.api.sendAsync("PATCH", `/releases/${draft.id}`, [["make_latest", ReleasePublisher.LATEST]], [["draft", false]]),
      "the published release");
    if (published.isDraft)
      throw new ReleaseException(`GitHub kept ${version.tag} as a draft when it was published.`);
    try {
      ReleasePublisher.requireComplete(published, digests);
      await this.requireTagAsync(version.tag, revision);
    }
    catch (error) {
      throw new ReleaseException(`${version.tag} is public now, but checking it after publishing failed: ${String(error)} Check it by hand; a published release is never replaced.`,
        { cause: error });
    }
    this.output.write(`Published ${version.tag} from ${revision} with ${digests.size} files.\n`);
  }

  private async createDraftAsync(version: ReleaseVersion, revision: string, notes: string): Promise<GitHubRelease> {
    const commit = await this.readTagAsync(version.tag);
    if (commit !== null)
      throw new ReleaseException(`The tag ${version.tag} already points at ${commit}, but no release uses it. A tag is never moved here; remove it by hand only if nothing was published from it.`);
    this.output.write(`Creating the draft release ${version.tag} for ${revision}.\n`);
    return GitHubRelease.read(await this.api.sendAsync("POST", "/releases",
      [["tag_name", version.tag], ["target_commitish", revision], ["name", version.text], ["body", notes]], [["draft", true]]), "the new release");
  }

  private async uploadAsync(release: GitHubRelease, name: string, file: string, digest: PackageDigest): Promise<void> {
    for (let attempt = 1; attempt <= ReleasePublisher.ATTEMPTS; attempt++) {
      if (await this.isUploadedAsync(release.id, name, digest))
        return;
      try {
        await this.api.uploadAsync(release.tag, file);
      }
      catch (error) {
        if (!ReleasePublisher.isTransient(error))
          throw error;
        this.output.write(`Uploading ${name} failed on attempt ${attempt} of ${ReleasePublisher.ATTEMPTS}: ${error.message}\n`);
        await timers.setTimeout(ReleasePublisher.RETRY_PAUSE);
      }
    }
    if (!await this.isUploadedAsync(release.id, name, digest))
      throw new ReleaseException(`${name} is still not uploaded after ${ReleasePublisher.ATTEMPTS} attempts.`);
  }

  private async isUploadedAsync(id: number, name: string, digest: PackageDigest): Promise<boolean> {
    const asset = (await this.readAsync(id)).assets.find(t => t.name === name);
    if (asset === undefined)
      return false;
    if (!asset.isUploaded) {
      this.output.write(`Deleting the incomplete upload of ${name}.\n`);
      await this.api.deleteAsync(`/releases/assets/${asset.id}`);
      return false;
    }
    ReleasePublisher.requireSame(asset, digest);
    return true;
  }

  private async readAsync(id: number): Promise<GitHubRelease> {
    return GitHubRelease.read(await this.api.readAsync(`/releases/${id}`), `release ${id}`);
  }

  private async createTagAsync(tag: string, revision: string): Promise<void> {
    try {
      await this.api.createAsync("/git/refs", [["ref", `${ReleasePublisher.TAG_PREFIX}${tag}`], ["sha", revision]]);
    }
    catch (error) {
      if (!(error instanceof GitHubException && error.status === ReleasePublisher.EXISTING_REFERENCE))
        throw error;
      const commit = await this.readTagAsync(tag);
      if (commit === null)
        throw error;
      if (commit !== revision)
        throw new ReleaseException(`The tag ${tag} appeared on ${commit}, not on ${revision}, so the draft stays unpublished.`);
    }
  }

  private async requireTagAsync(tag: string, revision: string): Promise<void> {
    const commit = await this.readTagAsync(tag);
    if (commit !== revision)
      throw new ReleaseException(`The tag ${tag} points at ${commit ?? "nothing"}, not at ${revision}.`);
  }

  private async readTagAsync(tag: string): Promise<string | null> {
    const context = `the tag ${tag}`;
    const reference = await this.api.readOptionalAsync(`/git/ref/tags/${tag}`);
    if (reference === null)
      return null;
    const target = GitHubJson.child(GitHubJson.object(reference, context), "object", context);
    if (GitHubJson.text(target, "type", context) !== ReleasePublisher.COMMIT_TYPE)
      throw new ReleaseException(`The tag ${tag} is annotated; a release's tag points straight at its commit.`);
    return GitHubJson.text(target, "sha", context);
  }
}
