/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthClientInformationFull, OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { OAuthClientInformationFullSchema } from "@modelcontextprotocol/sdk/shared/auth.js";

import { Resources } from "../resources.js";

export class SharedMcpOauthFlow implements OAuthClientProvider {
  public readonly redirectUrl: string;
  private readonly expectedState: string;
  private client: OAuthClientInformationFull | undefined;
  private saved: OAuthTokens | undefined;
  private verifier: string = String.empty;
  private authorization: string = String.empty;

  public constructor(redirectUrl: string, expectedState: string, client: OAuthClientInformationFull | undefined = undefined,
    tokens: OAuthTokens | undefined = undefined) {
    this.redirectUrl = redirectUrl;
    this.expectedState = expectedState;
    this.client = client;
    this.saved = tokens;
  }

  public get clientMetadata(): OAuthClientMetadata {
    return { redirect_uris: [this.redirectUrl], client_name: Resources.sharedMcpClientName, grant_types: [...Resources.sharedMcpGrantTypes],
      response_types: [Resources.sharedMcpResponseType], token_endpoint_auth_method: Resources.sharedMcpTokenAuthMethod };
  }

  public get authorizationUrl(): string {
    return this.authorization;
  }

  public get registeredClient(): OAuthClientInformationFull | undefined {
    return this.client;
  }

  public state(): string {
    return this.expectedState;
  }

  public clientInformation(): OAuthClientInformationFull | undefined {
    return this.client;
  }

  public saveClientInformation(client: OAuthClientInformationMixed): void {
    this.client = OAuthClientInformationFullSchema.parse({ ...this.clientMetadata, ...client });
  }

  public tokens(): OAuthTokens | undefined {
    return this.saved;
  }

  public saveTokens(tokens: OAuthTokens): void {
    this.saved = tokens;
  }

  public redirectToAuthorization(authorizationUrl: URL): void {
    this.authorization = authorizationUrl.toString();
  }

  public saveCodeVerifier(codeVerifier: string): void {
    this.verifier = codeVerifier;
  }

  public codeVerifier(): string {
    return this.verifier;
  }

  public invalidateCredentials(scope: string): void {
    if (scope === Resources.sharedMcpInvalidateAll || scope === Resources.sharedMcpInvalidateClient)
      this.client = undefined;
    if (scope === Resources.sharedMcpInvalidateAll || scope === Resources.sharedMcpInvalidateTokens)
      this.saved = undefined;
  }
}
