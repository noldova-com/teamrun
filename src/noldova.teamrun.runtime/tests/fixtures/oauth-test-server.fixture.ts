/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

export class OauthTestServer implements AsyncDisposable {
  public readonly requests: string[] = [];
  public readonly grants: string[] = [];
  public readonly revoked: Set<string> = new Set();
  public refreshRefusal: string | null = null;
  public expiresIn: number | null = 3_600;
  public givesRefreshToken: boolean = true;
  public answersWithout401: boolean = false;
  public answersWithBare401: boolean = false;
  public refusesRegistration: boolean = false;
  private readonly server: Server;
  private readonly challenges: Map<string, string> = new Map();
  private readonly hangs: Map<string, PromiseWithResolvers<void>> = new Map();
  private issued: number = 0;
  private held: { asked: PromiseWithResolvers<void>; released: PromiseWithResolvers<void> } | null = null;
  private origin: string = String();

  private constructor(server: Server) {
    this.server = server;
  }

  public get url(): string {
    return `${this.origin}/mcp`;
  }

  public static async startAsync(): Promise<OauthTestServer> {
    const server = createServer();
    const started = new OauthTestServer(server);
    server.on("request", (request: IncomingMessage, response: ServerResponse) => void started.answerAsync(request, response));
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    started.origin = `http://127.0.0.1:${Object.isNull(address) || Object.isString(address) ? 0 : address.port}`;
    return started;
  }

  public async signInInTheBrowserAsync(authorizationUrl: string): Promise<{ status: number; page: string }> {
    const callback = await fetch(await this.callbackOfAsync(authorizationUrl));
    return { status: callback.status, page: await callback.text() };
  }

  public async callbackOfAsync(authorizationUrl: string): Promise<string> {
    const answer = await fetch(authorizationUrl, { redirect: "manual" });
    return answer.headers.get("location") ?? authorizationUrl;
  }

  public hangAt(path: string): Promise<void> {
    const asked = Promise.withResolvers<void>();
    this.hangs.set(path, asked);
    return asked.promise;
  }

  public holdTokens(): { asked: Promise<void>; release: () => void } {
    const held = { asked: Promise.withResolvers<void>(), released: Promise.withResolvers<void>() };
    this.held = held;
    return { asked: held.asked.promise, release: () => {
      this.held = null;
      held.released.resolve();
    } };
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    this.server.closeAllConnections();
    await new Promise<void>(resolve => this.server.close(() => resolve()));
  }

  private async answerAsync(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const address = new URL(request.url ?? "/", this.origin);
    const body = await OauthTestServer.readAsync(request);
    this.requests.push(`${request.method} ${address.pathname}`);
    const hang = this.hangs.get(address.pathname);
    if (!Object.isUndefined(hang)) {
      hang.resolve();
      return;
    }
    switch (address.pathname) {
      case "/mcp":
        if (this.answersWithout401 || this.accepts(request.headers.authorization))
          return OauthTestServer.json(response, 200, {});
        if (this.answersWithBare401) {
          response.writeHead(401, { "WWW-Authenticate": "Bearer" }).end();
          return;
        }
        response.writeHead(401, { "WWW-Authenticate": `Bearer resource_metadata="${this.origin}/.well-known/oauth-protected-resource/mcp", scope="docs.read"` }).end();
        return;
      case "/.well-known/oauth-protected-resource/mcp":
        return OauthTestServer.json(response, 200, { resource: this.url, authorization_servers: [this.origin] });
      case "/.well-known/oauth-authorization-server":
        return OauthTestServer.json(response, 200, { issuer: this.origin, authorization_endpoint: `${this.origin}/authorize`, token_endpoint: `${this.origin}/token`,
          registration_endpoint: `${this.origin}/register`, response_types_supported: ["code"], code_challenge_methods_supported: ["S256"],
          grant_types_supported: ["authorization_code", "refresh_token"], token_endpoint_auth_methods_supported: ["none"] });
      case "/register":
        return this.refusesRegistration ? OauthTestServer.json(response, 400, { error: "invalid_client_metadata", error_description: "Registration is closed." })
          : OauthTestServer.json(response, 201, { client_id: "client-1", redirect_uris: JsonReader.parse(body).readStringArray("redirect_uris"),
            token_endpoint_auth_method: "none" });
      case "/authorize":
        return this.authorize(address, response);
      case "/token":
        return this.token(new URLSearchParams(body), response);
      default:
        response.writeHead(404).end();
    }
  }

  private authorize(address: URL, response: ServerResponse): void {
    const redirect = new URL(address.searchParams.get("redirect_uri") ?? this.origin);
    this.challenges.set("code-1", address.searchParams.get("code_challenge") ?? String());
    this.grants.push(`authorize ${address.searchParams.get("client_id")} ${address.searchParams.get("scope")} ${address.searchParams.get("resource")}`);
    redirect.searchParams.set("code", "code-1");
    redirect.searchParams.set("state", address.searchParams.get("state") ?? String());
    response.writeHead(302, { location: redirect.toString() }).end();
  }

  private accepts(authorization: string | undefined): boolean {
    const token = authorization?.replace("Bearer ", String()) ?? String();
    return /^access-\d+$/.test(token) && !this.revoked.has(token);
  }

  private async token(form: URLSearchParams, response: ServerResponse): Promise<void> {
    this.grants.push(form.get("grant_type") ?? String());
    const held = this.held;
    if (!Object.isNull(held)) {
      held.asked.resolve();
      await held.released.promise;
    }
    if (form.get("grant_type") === "authorization_code") {
      const verifier = createHash("sha256").update(form.get("code_verifier") ?? String()).digest("base64url");
      if (this.challenges.get(form.get("code") ?? String()) !== verifier)
        return OauthTestServer.json(response, 400, { error: "invalid_grant", error_description: "The code verifier doesn't match." });
    }
    else if (!Object.isNull(this.refreshRefusal))
      return OauthTestServer.json(response, 400, { error: this.refreshRefusal, error_description: "The refresh token was revoked." });
    this.issued += 1;
    OauthTestServer.json(response, 200, { access_token: `access-${this.issued}`, token_type: "Bearer",
      ...(Object.isNull(this.expiresIn) ? {} : { expires_in: this.expiresIn }), ...(this.givesRefreshToken ? { refresh_token: `refresh-${this.issued}` } : {}) });
  }

  private static json(response: ServerResponse, status: number, value: object): void {
    response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(value));
  }

  private static async readAsync(request: IncomingMessage): Promise<string> {
    request.setEncoding("utf8");
    let text = String();
    for await (const chunk of request)
      text += String(chunk);
    return text;
  }
}
