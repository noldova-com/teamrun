/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import path from "node:path";

export class DocsSiteServer {
  private static readonly HOST: string = "127.0.0.1";
  private static readonly ANY_PORT: number = 0;
  private static readonly ORIGIN: string = "http://localhost";
  private static readonly INDEX_FILE: string = "index.html";
  private static readonly OK_STATUS: number = 200;
  private static readonly NOT_FOUND_STATUS: number = 404;
  private static readonly FAILED_STATUS: number = 500;
  private static readonly ABSENT_CODES: readonly string[] = ["ENOENT", "EISDIR", "ENOTDIR"];
  private static readonly CONTENT_TYPE: string = "Content-Type";
  private static readonly DEFAULT_TYPE: string = "application/octet-stream";
  private static readonly TYPES: ReadonlyMap<string, string> = new Map([
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".mjs", "text/javascript; charset=utf-8"],
    [".css", "text/css; charset=utf-8"],
    [".json", "application/json"],
    [".map", "application/json"],
    [".svg", "image/svg+xml"],
    [".png", "image/png"],
    [".ico", "image/x-icon"],
    [".woff", "font/woff"],
    [".woff2", "font/woff2"],
    [".ttf", "font/ttf"],
    [".txt", "text/plain; charset=utf-8"],
    [".wasm", "application/wasm"]
  ]);

  private readonly root: string;
  private readonly server: Server = createServer((request, response) => void this.serveAsync(request, response));

  public constructor(root: string) {
    this.root = path.resolve(root);
  }

  public async startAsync(): Promise<string> {
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(DocsSiteServer.ANY_PORT, DocsSiteServer.HOST, () => resolve());
    });
    const address = this.server.address();
    const port = address === null || typeof address === "string" ? DocsSiteServer.ANY_PORT : address.port;
    return `http://${DocsSiteServer.HOST}:${port}`;
  }

  public stopAsync(): Promise<void> {
    this.server.closeAllConnections();
    return new Promise<void>(resolve => this.server.close(() => resolve()));
  }

  private async serveAsync(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const file = this.fileOf(request.url ?? String());
    let status = DocsSiteServer.NOT_FOUND_STATUS;
    const content = file === null ? null : await readFile(file).catch((error: unknown) => {
      if (!(error instanceof Error && "code" in error && typeof error.code === "string" && DocsSiteServer.ABSENT_CODES.includes(error.code)))
        status = DocsSiteServer.FAILED_STATUS;
      return null;
    });
    if (file === null || content === null) {
      response.writeHead(status);
      response.end();
      return;
    }
    response.writeHead(DocsSiteServer.OK_STATUS, { [DocsSiteServer.CONTENT_TYPE]: DocsSiteServer.TYPES.get(path.extname(file)) ?? DocsSiteServer.DEFAULT_TYPE });
    response.end(content);
  }

  private fileOf(url: string): string | null {
    const address = path.posix.normalize(new URL(url, DocsSiteServer.ORIGIN).pathname);
    const relative = path.posix.extname(address) === String() ? path.posix.join(address, DocsSiteServer.INDEX_FILE) : address;
    const file = path.resolve(this.root, `.${relative}`);
    return file.startsWith(`${this.root}${path.sep}`) ? file : null;
  }
}
