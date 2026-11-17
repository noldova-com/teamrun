/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { ProviderAbility } from "../enums/provider-ability.js";
import { Resources } from "../resources.js";
import { ProviderAbilities } from "./provider-abilities.js";
import { ProviderProfile } from "./provider-profile.js";

export class ProviderKind {
  private readonly untabled: { readonly resume: boolean; readonly fork: boolean; readonly ownMcpServersUnavailable: string | null };
  public readonly id: string;
  public readonly displayName: string;
  public readonly supportsSignInCheck: boolean;
  public readonly supportsSignIn: boolean;
  public readonly defaultModelName: string | null;
  public readonly profile: ProviderProfile | null;
  public readonly supportsSignOut: boolean;
  public readonly signOutCommand: string | null;
  public readonly signOutEndsWithCommand: boolean;
  public readonly singleAccount: string | null;
  public readonly followsOwnConfig: boolean;
  public readonly ownMcpServersNote: string | null;
  public readonly ownMcpServersShortNote: string | null;
  public readonly abilities: ProviderAbilities | null;
  public readonly namesChats: boolean;
  public readonly confirmsSignInAtPrompt: boolean;
  public readonly choosesServerPath: boolean;
  public readonly reportsLimits: boolean;
  public readonly carriesSessions: boolean;
  public readonly sessionsChecked: boolean;

  public constructor(
    id: string,
    displayName: string,
    supportsSignInCheck: boolean,
    supportsSignIn: boolean = false,
    defaultModelName: string | null = null,
    profile: ProviderProfile | null = null,
    supportsSignOut: boolean = false,
    signOutCommand: string | null = null,
    signOutEndsWithCommand: boolean = false,
    singleAccount: string | null = null,
    followsOwnConfig: boolean = false,
    ownMcpServersNote: string | null = null,
    abilities: ProviderAbilities | null = null, namesChats: boolean = false, confirmsSignInAtPrompt: boolean = false,
    untabled: { readonly resume: boolean; readonly fork: boolean; readonly ownMcpServersUnavailable: string | null } = { resume: false, fork: false, ownMcpServersUnavailable: null },
    ownMcpServersShortNote: string | null = null,
    choosesServerPath: boolean = false,
    reportsLimits: boolean = false,
    carriesSessions: boolean = true,
    sessionsChecked: boolean = false) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(displayName, Resources.displayNameField);
    if (!Object.isNull(signOutCommand))
      ArgumentException.throwIfNullOrWhitespace(signOutCommand, Resources.signOutCommandField);
    if (!Object.isNull(singleAccount))
      ArgumentException.throwIfNullOrWhitespace(singleAccount, Resources.singleAccountField);
    if (!Object.isNull(ownMcpServersShortNote))
      ArgumentException.throwIfNullOrWhitespace(ownMcpServersShortNote, Resources.ownMcpServersShortNoteField);

    this.id = id;
    this.displayName = displayName;
    this.supportsSignInCheck = supportsSignInCheck;
    this.supportsSignIn = supportsSignIn;
    this.defaultModelName = defaultModelName;
    this.profile = profile;
    this.supportsSignOut = supportsSignOut;
    this.signOutCommand = signOutCommand;
    this.signOutEndsWithCommand = signOutEndsWithCommand;
    this.singleAccount = singleAccount;
    this.followsOwnConfig = followsOwnConfig;
    this.ownMcpServersNote = ownMcpServersNote;
    this.abilities = abilities;
    this.namesChats = namesChats;
    this.confirmsSignInAtPrompt = confirmsSignInAtPrompt;
    this.untabled = untabled;
    this.ownMcpServersShortNote = ownMcpServersShortNote;
    this.choosesServerPath = choosesServerPath;
    this.reportsLimits = reportsLimits;
    this.carriesSessions = carriesSessions;
    this.sessionsChecked = sessionsChecked;
  }

  public get supportsResume(): boolean {
    return Object.isNull(this.abilities) ? this.untabled.resume : Object.isNull(this.abilities.cellOf(ProviderAbility.Resume).reasonAgainst());
  }

  public get supportsFork(): boolean {
    return Object.isNull(this.abilities) ? this.untabled.fork : Object.isNull(this.abilities.cellOf(ProviderAbility.Fork).reasonAgainst());
  }

  public get ownMcpServersUnavailable(): string | null {
    if (Object.isNull(this.abilities))
      return this.untabled.ownMcpServersUnavailable;
    const reason = this.abilities.cellOf(ProviderAbility.OwnServersSwitch).reasonAgainst();
    return Object.isNull(reason) ? null : Resources.formatAbilityRefused(this.displayName, Resources.ownServersSwitchAction, reason);
  }

  public reasonAgainst(ability: ProviderAbility): string | null {
    return Object.isNull(this.abilities) ? null : this.abilities.cellOf(ability).reasonAgainst();
  }

  public withNamesChats(namesChats: boolean): ProviderKind {
    return new ProviderKind(this.id, this.displayName, this.supportsSignInCheck, this.supportsSignIn, this.defaultModelName, this.profile, this.supportsSignOut,
      this.signOutCommand, this.signOutEndsWithCommand, this.singleAccount, this.followsOwnConfig, this.ownMcpServersNote, this.abilities, namesChats,
      this.confirmsSignInAtPrompt, this.untabled, this.ownMcpServersShortNote, this.choosesServerPath, this.reportsLimits,
      this.carriesSessions, this.sessionsChecked);
  }

  public static fromJson(value: unknown, path?: string): ProviderKind {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderKind(
      reader.readNonBlankString(Resources.idField),
      reader.readNonBlankString(Resources.displayNameField),
      reader.readBoolean(Resources.supportsSignInCheckField),
      reader.hasField(Resources.supportsSignInField) ? reader.readBoolean(Resources.supportsSignInField) : false,
      reader.hasField(Resources.defaultModelNameField) ? reader.readNullableString(Resources.defaultModelNameField) : null,
      ProviderKind.profileFromJson(reader),
      reader.hasField(Resources.supportsSignOutField) ? reader.readBoolean(Resources.supportsSignOutField) : false,
      reader.hasField(Resources.signOutCommandField) ? reader.readNullableString(Resources.signOutCommandField) : null,
      reader.hasField(Resources.signOutEndsWithCommandField) ? reader.readBoolean(Resources.signOutEndsWithCommandField) : false,
      reader.hasField(Resources.singleAccountField) ? reader.readNullableString(Resources.singleAccountField) : null,
      reader.hasField(Resources.followsOwnConfigField) ? reader.readBoolean(Resources.followsOwnConfigField) : false,
      reader.hasField(Resources.ownMcpServersNoteField) ? reader.readNullableString(Resources.ownMcpServersNoteField) : null,
      ProviderKind.abilitiesFromJson(reader), reader.hasField(Resources.namesChatsField) && reader.readBoolean(Resources.namesChatsField),
      reader.hasField(Resources.confirmsSignInAtPromptField) ? reader.readBoolean(Resources.confirmsSignInAtPromptField) : false,
      {
        resume: reader.readBoolean(Resources.supportsResumeField),
        fork: reader.hasField(Resources.supportsForkField) ? reader.readBoolean(Resources.supportsForkField) : false,
        ownMcpServersUnavailable: reader.hasField(Resources.ownMcpServersUnavailableField) ? reader.readNullableString(Resources.ownMcpServersUnavailableField) : null
      },
      reader.hasField(Resources.ownMcpServersShortNoteField) ? reader.readNullableString(Resources.ownMcpServersShortNoteField) : null,
      reader.hasField(Resources.choosesServerPathField) && reader.readBoolean(Resources.choosesServerPathField),
      reader.hasField(Resources.reportsLimitsField) && reader.readBoolean(Resources.reportsLimitsField),
      !reader.hasField(Resources.carriesSessionsField) || reader.readBoolean(Resources.carriesSessionsField),
      reader.hasField(Resources.sessionsCheckedField) && reader.readBoolean(Resources.sessionsCheckedField));
  }

  private static profileFromJson(reader: JsonReader): ProviderProfile | null {
    const profile = reader.hasField(Resources.profileField) ? reader.readNullableObject(Resources.profileField) : null;
    return Object.isNull(profile) ? null : ProviderProfile.fromJson(profile.toJson(), profile.path);
  }

  private static abilitiesFromJson(reader: JsonReader): ProviderAbilities | null {
    const abilities = reader.hasField(Resources.abilitiesField) ? reader.readNullableObject(Resources.abilitiesField) : null;
    return Object.isNull(abilities) ? null : ProviderAbilities.fromJson(abilities.toJson(), abilities.path);
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.displayNameField]: this.displayName,
      [Resources.supportsResumeField]: this.supportsResume,
      [Resources.supportsSignInCheckField]: this.supportsSignInCheck,
      [Resources.supportsForkField]: this.supportsFork,
      [Resources.supportsSignInField]: this.supportsSignIn,
      [Resources.defaultModelNameField]: this.defaultModelName,
      [Resources.profileField]: Object.isNull(this.profile) ? null : this.profile.toJson(),
      [Resources.ownMcpServersUnavailableField]: this.ownMcpServersUnavailable,
      [Resources.supportsSignOutField]: this.supportsSignOut,
      [Resources.signOutCommandField]: this.signOutCommand,
      [Resources.signOutEndsWithCommandField]: this.signOutEndsWithCommand,
      [Resources.singleAccountField]: this.singleAccount,
      [Resources.followsOwnConfigField]: this.followsOwnConfig,
      [Resources.ownMcpServersNoteField]: this.ownMcpServersNote,
      [Resources.ownMcpServersShortNoteField]: this.ownMcpServersShortNote,
      [Resources.abilitiesField]: Object.isNull(this.abilities) ? null : this.abilities.toJson(),
      [Resources.namesChatsField]: this.namesChats,
      [Resources.confirmsSignInAtPromptField]: this.confirmsSignInAtPrompt,
      [Resources.choosesServerPathField]: this.choosesServerPath,
      [Resources.reportsLimitsField]: this.reportsLimits,
      [Resources.carriesSessionsField]: this.carriesSessions,
      [Resources.sessionsCheckedField]: this.sessionsChecked
    };
  }
}
