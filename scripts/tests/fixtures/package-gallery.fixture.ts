/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import PinnedPackage from "../../packaging/pinned-package.ts";

export default class PackageGalleryFixture {
  public static readonly MODULE_FOLDER: string = "module";
  public static readonly TOOL_FOLDER: string = "tools/TrustedSigning/Fixture.Tool/Fixture.Tool.1.0.0";

  private static readonly MODULE_PATH: string = "/module";
  private static readonly TOOL_PATH: string = "/tool";
  private static readonly MISSING_PATH: string = "/missing";
  private static readonly MODULE_CONTENT: Buffer = Buffer.from("fixture module package\n");
  private static readonly TOOL_CONTENT: Buffer = Buffer.from("fixture tool package\n");
  private static readonly HOST: string = "127.0.0.1";

  private readonly server: Server;

  public readonly requests: string[] = [];

  private constructor(server: Server) {
    this.server = server;
  }

  public get module(): PinnedPackage {
    return new PinnedPackage(this.locate(PackageGalleryFixture.MODULE_PATH), PackageGalleryFixture.hash(PackageGalleryFixture.MODULE_CONTENT), PackageGalleryFixture.MODULE_FOLDER);
  }

  public get tool(): PinnedPackage {
    return new PinnedPackage(this.locate(PackageGalleryFixture.TOOL_PATH), PackageGalleryFixture.hash(PackageGalleryFixture.TOOL_CONTENT), PackageGalleryFixture.TOOL_FOLDER);
  }

  public get packages(): readonly PinnedPackage[] {
    return [this.module, this.tool];
  }

  public get missing(): PinnedPackage {
    return new PinnedPackage(this.locate(PackageGalleryFixture.MISSING_PATH), this.tool.sha512, PackageGalleryFixture.TOOL_FOLDER);
  }

  public static async createAsync(): Promise<PackageGalleryFixture> {
    const server = createServer();
    const gallery = new PackageGalleryFixture(server);
    server.on("request", (request, response) => {
      gallery.requests.push(request.url ?? "");
      if (request.url === PackageGalleryFixture.MODULE_PATH)
        response.end(PackageGalleryFixture.MODULE_CONTENT);
      else if (request.url === PackageGalleryFixture.TOOL_PATH)
        response.end(PackageGalleryFixture.TOOL_CONTENT);
      else
        response.writeHead(404).end();
    });
    await new Promise<void>(resolve => server.listen(0, PackageGalleryFixture.HOST, resolve));
    return gallery;
  }

  public withToolHash(sha512: string): readonly PinnedPackage[] {
    return [this.module, new PinnedPackage(this.tool.url, sha512, PackageGalleryFixture.TOOL_FOLDER)];
  }

  public async disposeAsync(): Promise<void> {
    const closed = new Promise<void>(resolve => this.server.close(() => resolve()));
    this.server.closeAllConnections();
    await closed;
  }

  private static hash(content: Buffer): string {
    return createHash("sha512").update(content).digest("base64");
  }

  private locate(file: string): string {
    const address: AddressInfo | string | null = this.server.address();
    const port = address !== null && typeof address === "object" ? address.port : 0;
    return `http://${PackageGalleryFixture.HOST}:${port}${file}`;
  }
}
