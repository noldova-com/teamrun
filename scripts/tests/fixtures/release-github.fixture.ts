/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import ProcessResult from "../../processes/process-result.ts";
import ProcessTimeoutException from "../../processes/process-timeout.exception.ts";
import ProcessException from "../../processes/process.exception.ts";
import GitHubApiFixture from "./github-api.fixture.ts";

type Upload = "uploads" | "fails" | "fails without a status" | "is refused" | "leaves an incomplete file" | "changes the file" | "times out" | "does not start";

class AssetRecord {
  public readonly id: number;
  public readonly name: string;
  public readonly size: number;
  public readonly state: string;
  public readonly digest: string | null;

  public constructor(id: number, name: string, size: number, state: string, digest: string | null) {
    this.id = id;
    this.name = name;
    this.size = size;
    this.state = state;
    this.digest = digest;
  }
}

class ReleaseRecord {
  public readonly id: number;
  public readonly tag: string;
  public readonly target: string;
  public isDraft: boolean;
  public assets: AssetRecord[] = [];

  public constructor(id: number, tag: string, target: string, isDraft: boolean) {
    this.id = id;
    this.tag = tag;
    this.target = target;
    this.isDraft = isDraft;
  }

  public toJSON(): unknown {
    return { id: this.id, tag_name: this.tag, target_commitish: this.target, draft: this.isDraft, assets: this.assets };
  }
}

export default class ReleaseGitHubFixture extends GitHubApiFixture {
  private static readonly NOT_FOUND: string = "gh: Not Found (HTTP 404)";
  private static readonly BAD_GATEWAY: string = "HTTP 502: Bad Gateway (https://uploads.github.com/)";
  private static readonly RELEASE: RegExp = /^\/releases\/(\d+)$/u;
  private static readonly TAG: RegExp = /^\/git\/ref\/tags\/(.+)$/u;
  private static readonly ASSET_PREFIX: string = "/releases/assets/";
  private static readonly REFERENCES: string = "/git/refs";
  private static readonly TAG_PREFIX: string = "refs/tags/";

  private readonly uploads: Map<string, Upload[]> = new Map<string, Upload[]>();
  private nextId: number = 1;

  public readonly releases: ReleaseRecord[] = [];
  public readonly tags: Map<string, string> = new Map<string, string>();
  public tagType: string = "commit";
  public isPublishingIgnored: boolean = false;
  public isTagDeletedOnPublish: boolean = false;
  public isTagReadFailingOnPublish: boolean = false;
  public assetOnPublish: string | null = null;
  public tagOnCreate: string | null = null;
  public referenceFailure: string | null = null;
  public isTagReadFailing: boolean = false;
  public tagOnUpload: string | null = null;

  public addRelease(tag: string, target: string, isDraft: boolean, files: readonly (readonly [string, string | null, number])[] = []): ReleaseRecord {
    const release = new ReleaseRecord(this.nextId++, tag, target, isDraft);
    release.assets = files.map(([name, digest, size]) => new AssetRecord(this.nextId++, name, size, "uploaded", digest));
    this.releases.push(release);
    if (!isDraft)
      this.tags.set(tag, target);
    return release;
  }

  public upload(name: string, outcomes: readonly Upload[]): void {
    this.uploads.set(name, [...outcomes]);
  }

  public leaveIncomplete(name: string): number {
    const id = this.nextId++;
    for (const release of this.releases)
      release.assets = release.assets.map(t => t.name === name ? new AssetRecord(id, name, 0, "starter", null) : t);
    return id;
  }

  public override async captureAsync(command: string, commandArguments: readonly string[]): Promise<ProcessResult> {
    if (commandArguments[0] !== "release" || path.parse(command).name !== "gh")
      return super.captureAsync(command, commandArguments);
    const [, , tag, file] = commandArguments;
    const name = path.basename(String(file));
    this.requests.push(`UPLOAD ${name}`);
    const release = this.releases.find(t => t.tag === tag && t.isDraft);
    if (release === undefined || commandArguments.slice(4).join(" ") !== `--repo ${GitHubApiFixture.REPOSITORY}`)
      return new ProcessResult(1, "", `release not found: ${String(tag)}`);
    if (this.tagOnUpload !== null)
      this.tags.set(release.tag, this.tagOnUpload);
    const outcome = this.uploads.get(name)?.shift() ?? "uploads";
    const content = await readFile(String(file));
    switch (outcome) {
      case "fails":
        return new ProcessResult(1, "", ReleaseGitHubFixture.BAD_GATEWAY);
      case "fails without a status":
        return new ProcessResult(1, "", "connection reset by peer");
      case "is refused":
        return new ProcessResult(1, "", "HTTP 422: Validation Failed (https://uploads.github.com/)");
      case "times out":
        throw new ProcessTimeoutException("\"gh\" did not finish within 900000 ms.");
      case "does not start":
        throw new ProcessException("\"gh\" could not start.");
      case "leaves an incomplete file":
        release.assets.push(new AssetRecord(this.nextId++, name, 0, "starter", null));
        return new ProcessResult(1, "", ReleaseGitHubFixture.BAD_GATEWAY);
      default:
        release.assets.push(new AssetRecord(this.nextId++, name, content.length, "uploaded",
          `sha256:${createHash("sha256").update(outcome === "changes the file" ? "changed" : content).digest("hex")}`));
        return new ProcessResult(0, "", "");
    }
  }

  protected override async respondAsync(method: string, resource: string, fields: ReadonlyMap<string, string>): Promise<ProcessResult> {
    const release = this.releases.find(t => t.id === Number(ReleaseGitHubFixture.RELEASE.exec(resource)?.[1]));
    const tag = ReleaseGitHubFixture.TAG.exec(resource)?.[1];
    if (method === "GET" && resource === "/releases")
      return ReleaseGitHubFixture.answer([this.releases]);
    if (method === "POST" && resource === "/releases")
      return ReleaseGitHubFixture.answer(this.addRelease(String(fields.get("tag_name")), String(fields.get("target_commitish")), fields.get("draft") === "true"));
    if (method === "POST" && resource === ReleaseGitHubFixture.REFERENCES)
      return this.createReference(String(fields.get("ref")).slice(ReleaseGitHubFixture.TAG_PREFIX.length), String(fields.get("sha")));
    if (method === "GET" && release !== undefined)
      return ReleaseGitHubFixture.answer(release);
    if (method === "PATCH" && release !== undefined)
      return ReleaseGitHubFixture.answer(this.publish(release));
    if (method === "DELETE" && resource.startsWith(ReleaseGitHubFixture.ASSET_PREFIX)) {
      for (const owner of this.releases)
        owner.assets = owner.assets.filter(t => `${ReleaseGitHubFixture.ASSET_PREFIX}${t.id}` !== resource);
      return new ProcessResult(0, "", "");
    }
    if (tag !== undefined && this.isTagReadFailing)
      return new ProcessResult(1, "", "gh: Server Error (HTTP 500)");
    const commit = tag === undefined ? undefined : this.tags.get(tag);
    if (commit !== undefined)
      return ReleaseGitHubFixture.answer({ ref: `refs/tags/${String(tag)}`, object: { sha: commit, type: this.tagType } });
    return new ProcessResult(1, "", ReleaseGitHubFixture.NOT_FOUND);
  }

  private static answer(value: unknown): ProcessResult {
    return new ProcessResult(0, JSON.stringify(value), "");
  }

  private createReference(tag: string, commit: string): ProcessResult {
    if (this.referenceFailure !== null)
      return new ProcessResult(1, "", this.referenceFailure);
    if (this.tagOnCreate !== null)
      this.tags.set(tag, this.tagOnCreate);
    if (this.tags.has(tag))
      return new ProcessResult(1, "", "gh: Reference already exists (HTTP 422)");
    this.tags.set(tag, commit);
    return ReleaseGitHubFixture.answer({ ref: `${ReleaseGitHubFixture.TAG_PREFIX}${tag}`, object: { sha: commit, type: "commit" } });
  }

  private publish(release: ReleaseRecord): ReleaseRecord {
    if (this.isPublishingIgnored)
      return release;
    release.isDraft = false;
    if (!this.tags.has(release.tag))
      this.tags.set(release.tag, release.target);
    if (this.isTagDeletedOnPublish)
      this.tags.delete(release.tag);
    this.isTagReadFailing ||= this.isTagReadFailingOnPublish;
    if (this.assetOnPublish !== null)
      release.assets.push(new AssetRecord(this.nextId++, this.assetOnPublish, 1, "uploaded", "sha256:00"));
    return release;
  }
}
