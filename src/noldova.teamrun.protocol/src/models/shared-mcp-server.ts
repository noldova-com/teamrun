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

import { SharedMcpSetting } from "../enums/shared-mcp-setting.js";
import { Resources } from "../resources.js";
import { SharedMcpSecret } from "./shared-mcp-secret.js";
import { SharedMcpServerDefinition } from "./shared-mcp-server-definition.js";
import { SharedMcpSignIn } from "./shared-mcp-sign-in.js";
import { SharedMcpTeammateSetting } from "./shared-mcp-teammate-setting.js";

export class SharedMcpServer {
  public readonly id: string;
  public readonly definition: SharedMcpServerDefinition;
  public readonly providerIds: readonly string[];
  public readonly teammates: readonly SharedMcpTeammateSetting[];
  public readonly createdAt: string;
  public readonly updatedAt: string;
  public readonly secrets: readonly SharedMcpSecret[];
  public readonly signIn: SharedMcpSignIn | null;

  public constructor(
    id: string,
    definition: SharedMcpServerDefinition,
    providerIds: readonly string[],
    teammates: readonly SharedMcpTeammateSetting[],
    createdAt: string,
    updatedAt: string,
    secrets: readonly SharedMcpSecret[] = [],
    signIn: SharedMcpSignIn | null = null) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    if (providerIds.some(t => t.trim().length === 0) || new Set(providerIds).size !== providerIds.length)
      throw new ArgumentException(Resources.duplicateSharedMcpProvider, Resources.providerIdsField);
    if (new Set(teammates.map(t => t.teammateId)).size !== teammates.length)
      throw new ArgumentException(Resources.duplicateSharedMcpTeammate, Resources.teammatesField);
    ArgumentException.throwIfNullOrWhitespace(createdAt, Resources.createdAtField);
    ArgumentException.throwIfNullOrWhitespace(updatedAt, Resources.updatedAtField);
    if (new Set(secrets.map(t => t.variable)).size !== secrets.length || new Set(secrets.map(t => t.reference)).size !== secrets.length)
      throw new ArgumentException(Resources.duplicateSharedMcpSecret, Resources.secretsField);
    if (!secrets.every(t => definition.referencedVariables.includes(t.variable)))
      throw new ArgumentException(Resources.sharedMcpSecretOfUnnamedVariable, Resources.secretsField);
    if (!Object.isNull(signIn) && !definition.signsIn)
      throw new ArgumentException(Resources.sharedMcpSignInWithoutSigningIn, Resources.signInField);

    this.id = id;
    this.definition = definition;
    this.providerIds = [...providerIds];
    this.teammates = [...teammates];
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.secrets = [...secrets];
    this.signIn = signIn;
  }

  public referenceOf(variable: string): string | null {
    return this.secrets.find(t => t.variable === variable)?.reference ?? null;
  }

  public settingOf(teammateId: string | null): SharedMcpSetting {
    return this.teammates.find(t => t.teammateId === teammateId)?.setting ?? SharedMcpSetting.AsProvider;
  }

  public reaches(providerId: string, teammateId: string | null): boolean {
    const setting = this.settingOf(teammateId);
    return setting === SharedMcpSetting.On || (setting === SharedMcpSetting.AsProvider && this.providerIds.includes(providerId));
  }

  public static fromJson(value: unknown, path?: string): SharedMcpServer {
    const reader = JsonReader.fromValue(value, path);
    const definition = reader.readObject(Resources.definitionField);
    return new SharedMcpServer(
      reader.readNonBlankString(Resources.idField),
      SharedMcpServerDefinition.fromJson(definition.toJson(), definition.path),
      reader.readStringArray(Resources.providerIdsField),
      reader.readObjectArray(Resources.teammatesField).map(t => SharedMcpTeammateSetting.fromJson(t.toJson(), t.path)),
      reader.readNonBlankString(Resources.createdAtField),
      reader.readNonBlankString(Resources.updatedAtField),
      reader.hasField(Resources.secretsField) ? reader.readObjectArray(Resources.secretsField).map(t => SharedMcpSecret.fromJson(t.toJson(), t.path)) : [],
      SharedMcpServer.signInOf(reader));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.definitionField]: this.definition.toJson(),
      [Resources.providerIdsField]: [...this.providerIds],
      [Resources.teammatesField]: this.teammates.map(t => t.toJson()),
      [Resources.createdAtField]: this.createdAt,
      [Resources.updatedAtField]: this.updatedAt,
      [Resources.secretsField]: this.secrets.map(t => t.toJson()),
      [Resources.signInField]: this.signIn?.toJson() ?? null
    };
  }

  private static signInOf(reader: JsonReader): SharedMcpSignIn | null {
    const signIn = reader.hasField(Resources.signInField) ? reader.readNullableObject(Resources.signInField) : null;
    return Object.isNull(signIn) ? null : SharedMcpSignIn.fromJson(signIn.toJson(), signIn.path);
  }
}
