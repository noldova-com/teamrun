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

import ModulePackage from "../../packaging/module-package.ts";

export default class ModuleGalleryFixture {
  public static readonly CONTENT: Buffer = Buffer.from("fixture module package\n");

  private static readonly PACKAGE_PATH: string = "/package";
  private static readonly MISSING_PATH: string = "/missing";
  private static readonly HOST: string = "127.0.0.1";

  private readonly server: Server;

  public readonly requests: string[] = [];

  private constructor(server: Server) {
    this.server = server;
  }

  public get package(): ModulePackage {
    return new ModulePackage(this.locate(ModuleGalleryFixture.PACKAGE_PATH), createHash("sha512").update(ModuleGalleryFixture.CONTENT).digest("base64"));
  }

  public get missing(): ModulePackage {
    return new ModulePackage(this.locate(ModuleGalleryFixture.MISSING_PATH), this.package.sha512);
  }

  public static async createAsync(): Promise<ModuleGalleryFixture> {
    const server = createServer();
    const gallery = new ModuleGalleryFixture(server);
    server.on("request", (request, response) => {
      gallery.requests.push(request.url ?? "");
      if (request.url === ModuleGalleryFixture.PACKAGE_PATH)
        response.end(ModuleGalleryFixture.CONTENT);
      else
        response.writeHead(404).end();
    });
    await new Promise<void>(resolve => server.listen(0, ModuleGalleryFixture.HOST, resolve));
    return gallery;
  }

  public withHash(sha512: string): ModulePackage {
    return new ModulePackage(this.package.url, sha512);
  }

  public async disposeAsync(): Promise<void> {
    const closed = new Promise<void>(resolve => this.server.close(() => resolve()));
    this.server.closeAllConnections();
    await closed;
  }

  private locate(file: string): string {
    const address: AddressInfo | string | null = this.server.address();
    const port = address !== null && typeof address === "object" ? address.port : 0;
    return `http://${ModuleGalleryFixture.HOST}:${port}${file}`;
  }
}
