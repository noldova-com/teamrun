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
import ProcessRunner from "../../processes/process-runner.ts";
import ProcessException from "../../processes/process.exception.ts";

type Upload = "uploads" | "fails" | "fails without a status" | "is refused" | "leaves an incomplete file" | "changes the file" | "times out";

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

export default class ReleaseGitHubFixture extends ProcessRunner {
  public static readonly REPOSITORY: string = "noldova-com/teamrun-release-trial";

  private static readonly PREFIX: string = `repos/${ReleaseGitHubFixture.REPOSITORY}`;
  private static readonly NOT_FOUND: string = "gh: Not Found (HTTP 404)";

  private readonly uploads: Map<string, Upload[]> = new Map<string, Upload[]>();
  private nextId: number = 1;

  public readonly releases: ReleaseRecord[] = [];
  public readonly tags: Map<string, string> = new Map<string, string>();
  public readonly requests: string[] = [];
  public readonly fields: string[] = [];
  public tagType: string = "commit";
  public isPublishingIgnored: boolean = false;
  public isTagReadFailing: boolean = false;

  public get writes(): readonly string[] {
    return this.requests.filter(t => !t.startsWith("GET "));
  }

  public addRelease(tag: string, target: string, draft: boolean, files: readonly (readonly [string, string | null, number])[] = []): ReleaseRecord {
    const release = new ReleaseRecord(this.nextId++, tag, target, draft);
    release.assets = files.map(([name, digest, size]) => new AssetRecord(this.nextId++, name, size, "uploaded", digest));
    this.releases.push(release);
    if (!draft)
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
    if (path.parse(command).name !== "gh")
      throw new Error(`Unexpected command ${command} ${commandArguments.join(" ")}.`);
    if (commandArguments[0] === "release")
      return this.uploadAsync(commandArguments);
    const endpoint = commandArguments.find(t => t.startsWith(ReleaseGitHubFixture.PREFIX));
    if (commandArguments[0] !== "api" || endpoint === undefined)
      throw new Error(`Unexpected command ${command} ${commandArguments.join(" ")}.`);
    const resource = endpoint.slice(ReleaseGitHubFixture.PREFIX.length);
    const methodIndex = commandArguments.indexOf("--method");
    const method = methodIndex < 0 ? "GET" : String(commandArguments[methodIndex + 1]);
    this.requests.push(`${method} ${resource}`);
    const fields = new Map(commandArguments.filter((_, index) => ["--raw-field", "--field"].includes(String(commandArguments[index - 1])))
      .map(t => [t.slice(0, t.indexOf("=")), t.slice(t.indexOf("=") + 1)]));
    this.fields.push(...[...fields].map(([name, value]) => `${name}=${value}`));
    return this.answer(method, resource, fields);
  }

  private answer(method: string, resource: string, fields: ReadonlyMap<string, string>): ProcessResult {
    const releaseMatch = /^\/releases\/(\d+)$/u.exec(resource);
    const release = this.releases.find(t => t.id === Number(releaseMatch?.[1]));
    const tagMatch = /^\/git\/ref\/tags\/(.+)$/u.exec(resource);
    if (method === "GET" && resource === "/releases")
      return ReleaseGitHubFixture.json([this.releases]);
    if (method === "POST" && resource === "/releases")
      return ReleaseGitHubFixture.json(this.addRelease(String(fields.get("tag_name")), String(fields.get("target_commitish")), fields.get("draft") !== "false"));
    if (method === "GET" && release !== undefined)
      return ReleaseGitHubFixture.json(release);
    if (method === "PATCH" && release !== undefined) {
      if (!this.isPublishingIgnored) {
        release.isDraft = false;
        this.tags.set(release.tag, release.target);
      }
      return ReleaseGitHubFixture.json(release);
    }
    if (method === "DELETE" && resource.startsWith("/releases/assets/")) {
      for (const owner of this.releases)
        owner.assets = owner.assets.filter(t => `/releases/assets/${t.id}` !== resource);
      return new ProcessResult(0, "", "");
    }
    if (tagMatch?.[1] !== undefined) {
      const commit = this.tags.get(tagMatch[1]);
      if (this.isTagReadFailing)
        return new ProcessResult(1, "", "gh: Server Error (HTTP 500)");
      return commit === undefined ? new ProcessResult(1, "", ReleaseGitHubFixture.NOT_FOUND)
        : ReleaseGitHubFixture.json({ ref: `refs/tags/${tagMatch[1]}`, object: { sha: commit, type: this.tagType } });
    }
    return new ProcessResult(1, "", ReleaseGitHubFixture.NOT_FOUND);
  }

  private async uploadAsync(commandArguments: readonly string[]): Promise<ProcessResult> {
    const [, , tag, file] = commandArguments;
    const name = path.basename(String(file));
    this.requests.push(`UPLOAD ${name}`);
    const release = this.releases.find(t => t.tag === tag && t.isDraft);
    if (release === undefined || commandArguments.slice(4).join(" ") !== `--repo ${ReleaseGitHubFixture.REPOSITORY}`)
      return new ProcessResult(1, "", `release not found: ${String(tag)}`);
    const outcome = this.uploads.get(name)?.shift() ?? "uploads";
    const content = await readFile(String(file));
    const digest = `sha256:${createHash("sha256").update(outcome === "changes the file" ? "changed" : content).digest("hex")}`;
    switch (outcome) {
      case "fails":
        return new ProcessResult(1, "", "HTTP 502: Bad Gateway (https://uploads.github.com/)");
      case "fails without a status":
        return new ProcessResult(1, "", "connection reset by peer");
      case "is refused":
        return new ProcessResult(1, "", "HTTP 422: Validation Failed (https://uploads.github.com/)");
      case "times out":
        throw new ProcessException("\"gh\" did not finish within 900000 ms.");
      case "leaves an incomplete file":
        release.assets.push(new AssetRecord(this.nextId++, name, 0, "starter", null));
        return new ProcessResult(1, "", "HTTP 502: Bad Gateway (https://uploads.github.com/)");
      default:
        release.assets.push(new AssetRecord(this.nextId++, name, content.length, "uploaded", digest));
        return new ProcessResult(0, "", "");
    }
  }

  private static json(value: unknown): ProcessResult {
    return new ProcessResult(0, JSON.stringify(value), "");
  }
}
