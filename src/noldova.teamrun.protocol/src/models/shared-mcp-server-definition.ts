/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { SharedMcpAccount } from "../enums/shared-mcp-account.js";
import { SharedMcpTransport } from "../enums/shared-mcp-transport.js";
import { Resources } from "../resources.js";
import { SharedMcpHeader } from "./shared-mcp-header.js";

export class SharedMcpServerDefinition {
  public static readonly gitHub: SharedMcpServerDefinition = new SharedMcpServerDefinition(Resources.gitHubMcpServerName, SharedMcpTransport.Http,
    null, [], [], Resources.gitHubMcpServerUrl, [], null, false, SharedMcpAccount.GitHub);

  public readonly name: string;
  public readonly transport: SharedMcpTransport;
  public readonly command: string | null;
  public readonly arguments: readonly string[];
  public readonly variables: readonly string[];
  public readonly url: string | null;
  public readonly headers: readonly SharedMcpHeader[];
  public readonly bearerVariable: string | null;
  public readonly signsIn: boolean;
  public readonly account: SharedMcpAccount | null;

  public constructor(
    name: string,
    transport: SharedMcpTransport,
    command: string | null,
    args: readonly string[],
    variables: readonly string[],
    url: string | null,
    headers: readonly SharedMcpHeader[],
    bearerVariable: string | null,
    signsIn: boolean = false,
    account: SharedMcpAccount | null = null) {
    if (!Resources.sharedMcpServerNamePattern.test(name) || name === Resources.mcpServerName)
      throw new ArgumentException(Resources.invalidSharedMcpServerName, Resources.nameField);
    if (!Object.values(SharedMcpTransport).includes(transport))
      throw new ArgumentException(Resources.invalidSharedMcpTransport, Resources.transportField);
    const named = Object.isNull(bearerVariable) ? variables : [...variables, bearerVariable];
    if (!named.every(t => Resources.environmentVariablePattern.test(t)))
      throw new ArgumentException(Resources.invalidEnvironmentVariable, Resources.variablesField);
    if (new Set(variables).size !== variables.length)
      throw new ArgumentException(Resources.duplicateSharedMcpVariable, Resources.variablesField);
    if (new Set(headers.map(t => t.name.toLowerCase())).size !== headers.length)
      throw new ArgumentException(Resources.duplicateHttpHeader, Resources.headersField);
    if (!Object.isNull(bearerVariable) && headers.some(t => t.name.toLowerCase() === Resources.authorizationHeaderName))
      throw new ArgumentException(Resources.authorizationHeaderWithBearer, Resources.headersField);
    if (transport === SharedMcpTransport.Stdio && !SharedMcpServerDefinition.isStdio(command, url, headers, bearerVariable))
      throw new ArgumentException(Resources.invalidSharedMcpStdio, Resources.transportField);
    if (transport === SharedMcpTransport.Http && !SharedMcpServerDefinition.isHttp(url, command, args, variables))
      throw new ArgumentException(Resources.invalidSharedMcpHttp, Resources.transportField);
    if (signsIn && (transport !== SharedMcpTransport.Http || !Object.isNull(bearerVariable) || headers.some(t => t.name.toLowerCase() === Resources.authorizationHeaderName)))
      throw new ArgumentException(Resources.invalidSharedMcpSignsIn, Resources.signsInField);
    if (!Object.isNull(account) && (!Object.values(SharedMcpAccount).includes(account) || transport !== SharedMcpTransport.Http || signsIn
      || !Object.isNull(bearerVariable) || headers.some(t => t.name.toLowerCase() === Resources.authorizationHeaderName)))
      throw new ArgumentException(Resources.invalidSharedMcpAccount, Resources.accountField);
    if (!Object.isNull(account) && new URL(String(url)).origin !== new URL(Resources.gitHubMcpServerUrl).origin)
      throw new ArgumentException(Resources.formatSharedMcpAccountAddress(account, new URL(Resources.gitHubMcpServerUrl).origin), Resources.urlField);
    if (transport === SharedMcpTransport.Http && SharedMcpServerDefinition.holdsSecret(new URL(url!)))
      throw new ArgumentException(Resources.sharedMcpAddressHoldsSecret, Resources.urlField);

    this.name = name;
    this.transport = transport;
    this.command = command;
    this.arguments = [...args];
    this.variables = [...variables];
    this.url = url;
    this.headers = [...headers];
    this.bearerVariable = bearerVariable;
    this.signsIn = signsIn;
    this.account = account;
  }

  public get referencedVariables(): readonly string[] {
    return [...this.variables, ...this.headers.map(t => t.variable), ...(Object.isNull(this.bearerVariable) ? [] : [this.bearerVariable])];
  }

  public static fromJson(value: unknown, path?: string): SharedMcpServerDefinition {
    const reader = JsonReader.fromValue(value, path);
    return new SharedMcpServerDefinition(
      reader.readNonBlankString(Resources.nameField),
      reader.readOneOf(Resources.transportField, Object.values(SharedMcpTransport)),
      reader.readNullableString(Resources.commandField),
      reader.readStringArray(Resources.argumentsField),
      reader.readStringArray(Resources.variablesField),
      reader.readNullableString(Resources.urlField),
      reader.readObjectArray(Resources.headersField).map(t => SharedMcpHeader.fromJson(t.toJson(), t.path)),
      reader.readNullableString(Resources.bearerVariableField),
      reader.hasField(Resources.signsInField) && reader.readBoolean(Resources.signsInField),
      reader.hasField(Resources.accountField) && !Object.isNull(reader.readNullableString(Resources.accountField))
        ? reader.readOneOf(Resources.accountField, Object.values(SharedMcpAccount)) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.nameField]: this.name,
      [Resources.transportField]: this.transport,
      [Resources.commandField]: this.command,
      [Resources.argumentsField]: [...this.arguments],
      [Resources.variablesField]: [...this.variables],
      [Resources.urlField]: this.url,
      [Resources.headersField]: this.headers.map(t => t.toJson()),
      [Resources.bearerVariableField]: this.bearerVariable,
      [Resources.signsInField]: this.signsIn,
      [Resources.accountField]: this.account
    };
  }

  private static isStdio(command: string | null, url: string | null, headers: readonly SharedMcpHeader[], bearerVariable: string | null): boolean {
    return !Object.isNull(command) && command.trim().length > 0 && Object.isNull(url) && headers.length === 0 && Object.isNull(bearerVariable);
  }

  private static isHttp(url: string | null, command: string | null, args: readonly string[], variables: readonly string[]): boolean {
    return !Object.isNull(url) && SharedMcpServerDefinition.isHttpUrl(url) && Object.isNull(command) && args.length === 0 && variables.length === 0;
  }

  private static holdsSecret(address: URL): boolean {
    return address.username.length > 0 || address.password.length > 0 || [...address.searchParams.keys()].some(t => Resources.secretQueryNamePattern.test(t));
  }

  private static isHttpUrl(url: string): boolean {
    try {
      return Resources.httpUrlProtocols.includes(new URL(url).protocol);
    }
    catch {
      return false;
    }
  }
}
