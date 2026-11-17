/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import "@noldova/context.core";
import { auth, extractWWWAuthenticateParams } from "@modelcontextprotocol/sdk/client/auth.js";
import { type OAuthClientInformationFull, OAuthClientInformationFullSchema, type OAuthTokens, OAuthTokensSchema } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { IModuleSecrets } from "@noldova/desktop.runtime";
import { type ISharedMcpSignIn, SharedMcpAccess } from "@noldova/teamrun.core";

import type { ISharedMcpChallenge } from "../interfaces/i-shared-mcp-challenge.js";
import { SharedMcpSavedSignIn } from "../models/shared-mcp-saved-sign-in.js";
import { Resources } from "../resources.js";
import { SharedMcpOauthFlow } from "./shared-mcp-oauth-flow.js";

export class SharedMcpOauth implements ISharedMcpSignIn {
  private readonly secrets: IModuleSecrets;
  private readonly expiry: () => AbortSignal;
  private readonly now: () => number;
  private readonly deadline: () => AbortSignal;
  private readonly reads: Map<string, Promise<SharedMcpAccess>> = new Map();
  private readonly attempts: Map<string, () => void> = new Map();
  private readonly queues: Map<string, Promise<void>> = new Map();

  public constructor(secrets: IModuleSecrets, expiry: () => AbortSignal = () => AbortSignal.timeout(Resources.sharedMcpSignInTimeout), now: () => number = Date.now,
    deadline: () => AbortSignal = () => AbortSignal.timeout(Resources.sharedMcpRequestTimeout)) {
    this.secrets = secrets;
    this.expiry = expiry;
    this.now = now;
    this.deadline = deadline;
  }

  public async startAsync(url: string, reference: string, finished: (access: SharedMcpAccess) => void): Promise<string> {
    const challenge = await SharedMcpOauth.challengeAsync(url);
    const server = createServer();
    const port = await SharedMcpOauth.listenAsync(server);
    const flow = new SharedMcpOauthFlow(Resources.formatSharedMcpRedirectUrl(port), randomBytes(Resources.sharedMcpStateBytes).toString(Resources.hexEncoding));
    try {
      await auth(flow, this.optionsOf(url, challenge, null));
    }
    catch (error) {
      SharedMcpOauth.close(server);
      throw error;
    }

    const ended = Promise.withResolvers<SharedMcpAccess | null>();
    const expiry = this.expiry();
    const expire = (): void => ended.resolve(SharedMcpAccess.refused(Resources.sharedMcpSignInTimedOut));
    expiry.addEventListener(Resources.abortEvent, expire, { once: true });
    if (expiry.aborted)
      expire();
    const supersede = (): void => ended.resolve(null);
    this.attempts.get(reference)?.();
    this.attempts.set(reference, supersede);
    void ended.promise.then(access => {
      expiry.removeEventListener(Resources.abortEvent, expire);
      SharedMcpOauth.close(server);
      if (this.attempts.get(reference) === supersede)
        this.attempts.delete(reference);
      if (!Object.isNull(access))
        finished(access);
    });
    let answered = false;
    server.on(Resources.requestEvent, (request: IncomingMessage, response: ServerResponse) => {
      const address = new URL(String(request.url), flow.redirectUrl);
      if (address.pathname !== Resources.sharedMcpCallbackPath || answered) {
        response.writeHead(Resources.notFoundStatus).end();
        return;
      }
      answered = true;
      expiry.removeEventListener(Resources.abortEvent, expire);
      void this.answerAsync(address, response, url, reference, flow, challenge).then(t => ended.resolve(t));
    });
    return flow.authorizationUrl;
  }

  public accessAsync(url: string, reference: string): Promise<SharedMcpAccess> {
    const running = this.reads.get(reference);
    if (!Object.isUndefined(running))
      return running;
    const read = this.serialize(reference, () => this.readAccessAsync(url, reference)).finally(() => this.reads.delete(reference));
    this.reads.set(reference, read);
    return read;
  }

  public signOutAsync(reference: string): Promise<void> {
    this.attempts.get(reference)?.();
    return this.serialize(reference, () => this.secrets.removeAsync(reference));
  }

  private async answerAsync(address: URL, response: ServerResponse, url: string, reference: string, flow: SharedMcpOauthFlow,
    challenge: ISharedMcpChallenge): Promise<SharedMcpAccess> {
    const code = address.searchParams.get(Resources.codeParameter);
    const refusal = address.searchParams.get(Resources.errorParameter);
    let access: SharedMcpAccess;
    if (address.searchParams.get(Resources.stateParameter) !== flow.state())
      access = SharedMcpAccess.refused(Resources.sharedMcpSignInStateMismatch);
    else if (!Object.isNull(refusal))
      access = SharedMcpAccess.refused(Resources.formatSharedMcpSignInDenied(refusal));
    else if (Object.isNull(code))
      access = SharedMcpAccess.refused(Resources.sharedMcpSignInWithoutCode);
    else
      access = await this.exchangeAsync(url, reference, flow, challenge, code);
    response.writeHead(Resources.okStatus, { [Resources.contentTypeHeader]: Resources.htmlContentType })
      .end(Object.isNull(access.needsSignIn) ? Resources.sharedMcpSignedInPage : Resources.sharedMcpSignInFailedPage);
    return access;
  }

  private exchangeAsync(url: string, reference: string, flow: SharedMcpOauthFlow, challenge: ISharedMcpChallenge, code: string): Promise<SharedMcpAccess> {
    return this.serialize(reference, async () => {
      try {
        await auth(flow, this.optionsOf(url, challenge, code));
        return await this.saveAsync(reference, flow, challenge);
      }
      catch (error) {
        return SharedMcpAccess.refused(Resources.formatSharedMcpSignInFailed(SharedMcpOauth.describe(error)));
      }
    });
  }

  private serialize<T>(reference: string, work: () => Promise<T>): Promise<T> {
    const done = (this.queues.get(reference) ?? Promise.resolve()).then(work);
    const settled = done.then(() => undefined, () => undefined);
    this.queues.set(reference, settled);
    void settled.then(() => {
      if (this.queues.get(reference) === settled)
        this.queues.delete(reference);
    });
    return done;
  }

  private async readAccessAsync(url: string, reference: string): Promise<SharedMcpAccess> {
    const text = await this.secrets.readAsync(reference);
    if (Object.isNull(text))
      return SharedMcpAccess.refused(Resources.sharedMcpSignInMissing);
    const saved = SharedMcpSavedSignIn.parse(text);
    if (Object.isNull(saved.expiresAt) ? await this.acceptsAsync(url, saved.tokens.access_token)
      : Date.parse(saved.expiresAt) - this.now() > Resources.sharedMcpRefreshMargin)
      return SharedMcpAccess.granted(saved.tokens.access_token, saved.expiresAt);
    if (Object.isUndefined(saved.tokens.refresh_token))
      return SharedMcpAccess.refused(Object.isNull(saved.expiresAt) ? Resources.sharedMcpSignInRevoked : Resources.sharedMcpSignInExpiredForGood);

    const flow = new SharedMcpOauthFlow(saved.redirectUrl, randomBytes(Resources.sharedMcpStateBytes).toString(Resources.hexEncoding), saved.client, saved.tokens);
    const challenge = { resourceMetadataUrl: saved.resourceMetadataUrl, scope: saved.scope };
    try {
      if (await auth(flow, this.optionsOf(url, challenge, null)) !== Resources.sharedMcpAuthorizedResult)
        return SharedMcpAccess.refused(Resources.sharedMcpRefreshRefused);
      return await this.saveAsync(reference, flow, challenge);
    }
    catch (error) {
      return SharedMcpAccess.refused(Resources.formatSharedMcpRefreshFailed(SharedMcpOauth.describe(error)));
    }
  }

  private saveAsync(reference: string, flow: SharedMcpOauthFlow, challenge: ISharedMcpChallenge): Promise<SharedMcpAccess> {
    return this.writeAsync(reference, flow.redirectUrl, challenge, OAuthClientInformationFullSchema.parse(flow.registeredClient),
      OAuthTokensSchema.parse(flow.tokens()));
  }

  private async writeAsync(reference: string, redirectUrl: string, challenge: ISharedMcpChallenge, client: OAuthClientInformationFull, tokens: OAuthTokens)
    : Promise<SharedMcpAccess> {
    const expiresAt = Object.isUndefined(tokens.expires_in) ? null : new Date(this.now() + tokens.expires_in * Resources.millisecondsPerSecond).toISOString();
    await this.secrets.saveAsync(reference, new SharedMcpSavedSignIn(redirectUrl, challenge.resourceMetadataUrl, challenge.scope, client, tokens,
      expiresAt).toText());
    return SharedMcpAccess.granted(tokens.access_token, expiresAt);
  }

  private static async challengeAsync(url: string): Promise<ISharedMcpChallenge> {
    const response = await fetch(url, { method: Resources.postMethod, headers: { [Resources.contentTypeHeader]: Resources.jsonContentType,
      [Resources.acceptHeader]: Resources.mcpAcceptTypes }, body: Resources.sharedMcpProbeBody, redirect: Resources.manualRedirect });
    await response.body?.cancel();
    if (response.status !== Resources.unauthorizedStatus)
      return { resourceMetadataUrl: null, scope: null };
    const { resourceMetadataUrl, scope } = extractWWWAuthenticateParams(response);
    return { resourceMetadataUrl: resourceMetadataUrl?.toString() ?? null, scope: scope ?? null };
  }

  private acceptsAsync(url: string, token: string): Promise<boolean> {
    return fetch(url, { method: Resources.postMethod, headers: { [Resources.contentTypeHeader]: Resources.jsonContentType,
      [Resources.acceptHeader]: Resources.mcpAcceptTypes, [Resources.authorizationHeader]: `${Resources.bearerScheme} ${token}` },
      body: Resources.sharedMcpTokenProbeBody, redirect: Resources.manualRedirect, signal: this.deadline() })
      .then(async response => {
        await response.body?.cancel();
        return response.status !== Resources.unauthorizedStatus;
      }, () => true);
  }

  private optionsOf(url: string, challenge: ISharedMcpChallenge, code: string | null)
    : { serverUrl: string; resourceMetadataUrl?: URL; scope?: string; authorizationCode?: string; fetchFn: typeof fetch } {
    return { serverUrl: url, fetchFn: (input, init) => fetch(input, { ...init, signal: this.deadline() }), ...(Object.isNull(challenge.resourceMetadataUrl) ? {} : { resourceMetadataUrl: new URL(challenge.resourceMetadataUrl) }),
      ...(Object.isNull(challenge.scope) ? {} : { scope: challenge.scope }), ...(Object.isNull(code) ? {} : { authorizationCode: code }) };
  }

  private static listenAsync(server: Server): Promise<number> {
    return new Promise((resolve, reject) => {
      server.once(Resources.errorEvent, reject);
      server.listen(0, Resources.loopbackAddress, () => {
        server.off(Resources.errorEvent, reject);
        resolve(Object.assign({ port: 0 }, server.address()).port);
      });
    });
  }

  private static close(server: Server): void {
    server.closeAllConnections();
    server.close();
  }

  private static describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
