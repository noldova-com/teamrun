/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type OAuthClientInformationFull, OAuthClientInformationFullSchema, type OAuthTokens, OAuthTokensSchema } from "@modelcontextprotocol/sdk/shared/auth.js";
import { JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class SharedMcpSavedSignIn {
  public readonly redirectUrl: string;
  public readonly resourceMetadataUrl: string | null;
  public readonly scope: string | null;
  public readonly client: OAuthClientInformationFull;
  public readonly tokens: OAuthTokens;
  public readonly expiresAt: string | null;

  public constructor(redirectUrl: string, resourceMetadataUrl: string | null, scope: string | null, client: OAuthClientInformationFull, tokens: OAuthTokens,
    expiresAt: string | null) {
    this.redirectUrl = redirectUrl;
    this.resourceMetadataUrl = resourceMetadataUrl;
    this.scope = scope;
    this.client = client;
    this.tokens = tokens;
    this.expiresAt = expiresAt;
  }

  public static parse(text: string): SharedMcpSavedSignIn {
    const reader = JsonReader.parse(text);
    return new SharedMcpSavedSignIn(reader.readNonBlankString(Resources.redirectUrlField), reader.readNullableString(Resources.resourceMetadataUrlField),
      reader.readNullableString(Resources.scopeField), OAuthClientInformationFullSchema.parse(reader.readObject(Resources.clientField).toJson()),
      OAuthTokensSchema.parse(reader.readObject(Resources.tokensField).toJson()), reader.readNullableString(Resources.expiresAtField));
  }

  public toText(): string {
    return JSON.stringify({ [Resources.redirectUrlField]: this.redirectUrl, [Resources.resourceMetadataUrlField]: this.resourceMetadataUrl,
      [Resources.scopeField]: this.scope, [Resources.clientField]: this.client, [Resources.tokensField]: this.tokens, [Resources.expiresAtField]: this.expiresAt });
  }
}
