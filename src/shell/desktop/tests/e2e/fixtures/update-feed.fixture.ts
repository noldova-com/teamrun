/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import path from "node:path";

import { FeedSource } from "@noldova/teamrun-shell-desktop";
import { ProductInfo } from "@noldova/teamrun-shell-runtime";

export default class UpdateFeedFixture {
  public static readonly VARIANT: string = "update-feed";

  private static readonly HOST: string = "127.0.0.1";
  private static readonly RELEASE_DATE: string = "2026-10-06T00:00:00.000Z";

  private readonly server: Server;

  public readonly folder: string;
  public readonly url: string;
  public readonly requests: readonly string[];

  private constructor(server: Server, folder: string, url: string, requests: readonly string[]) {
    this.server = server;
    this.folder = folder;
    this.url = url;
    this.requests = requests;
  }

  public static get source(): FeedSource {
    const source = FeedSource.create(`http://${UpdateFeedFixture.HOST}/`, ProductInfo.current.name, process.platform, process.arch, () => Promise.reject(new Error("The fixture never fetches.")));
    if (source === null)
      throw new Error(`No update package is defined for ${process.platform} ${process.arch}.`);
    return source;
  }

  public static sha512(contents: Buffer): string {
    return createHash("sha512").update(contents).digest("base64");
  }

  public static async startAsync(folder: string): Promise<UpdateFeedFixture> {
    const feed = ProductInfo.read(ProductInfo.file).updateFeed;
    if (feed === null || new URL(feed).hostname !== UpdateFeedFixture.HOST)
      throw new Error(`The build's product file names no feed on ${UpdateFeedFixture.HOST}; swap in the ${UpdateFeedFixture.VARIANT} variant first.`);
    await mkdir(folder, { recursive: true });
    const requests: string[] = [];
    const server = createServer((request, response) => {
      const name = decodeURIComponent(new URL(request.url ?? "/", `http://${UpdateFeedFixture.HOST}`).pathname.slice(1));
      requests.push(name);
      const file = path.join(folder, name);
      if (name.length === 0 || name.includes("/") || name.includes("\\")) {
        response.writeHead(404).end();
        return;
      }
      stat(file).then(found => {
        response.writeHead(200, { "Content-Length": found.size });
        createReadStream(file).pipe(response);
      }, () => response.writeHead(404).end());
    });
    const port = Number(new URL(feed).port);
    server.listen(port, UpdateFeedFixture.HOST);
    await once(server, "listening").catch((error: unknown) => {
      throw new Error(`The update feed cannot listen on ${UpdateFeedFixture.HOST}:${port}, which the ${UpdateFeedFixture.VARIANT} variant names; another process holds it: ${String(error)}`);
    });
    return new UpdateFeedFixture(server, folder, feed, requests);
  }

  public async publishAsync(version: string, contents: Buffer): Promise<string> {
    const source = UpdateFeedFixture.source;
    const sha512 = UpdateFeedFixture.sha512(contents);
    await writeFile(path.join(this.folder, source.packageFile), contents);
    await writeFile(path.join(this.folder, source.channelFile), [
      `version: ${version}`,
      "files:",
      `  - url: ${source.packageFile}`,
      `    sha512: ${sha512}`,
      `    size: ${contents.length}`,
      `path: ${source.packageFile}`,
      `sha512: ${sha512}`,
      `releaseDate: '${UpdateFeedFixture.RELEASE_DATE}'`,
      ""
    ].join("\n"));
    return sha512;
  }

  public async disposeAsync(): Promise<void> {
    this.server.closeAllConnections();
    this.server.close();
    await once(this.server, "close");
  }
}
