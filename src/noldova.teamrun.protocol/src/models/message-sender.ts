/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { TeammateName } from "../services/teammate-name.js";

export class MessageSender {
  public readonly chatId: string;
  public readonly teammateId: string | null;
  public readonly name: string;
  public readonly outside: boolean;

  public constructor(
    chatId: string,
    teammateId: string | null,
    name: string,
    outside: boolean = false) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    if (!Object.isNull(teammateId))
      ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    if (outside && !Object.isNull(teammateId))
      throw new ArgumentException(Resources.outsideSenderWithTeammate, Resources.teammateIdField);
    if (outside)
      MessageSender.validateOutsideLabel(name);
    else if (Object.isNull(teammateId))
      MessageSender.validateDefaultName(name);
    else
      TeammateName.validate(name);

    this.chatId = chatId;
    this.teammateId = teammateId;
    this.name = name;
    this.outside = outside;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): MessageSender {
    const reader = JsonReader.fromValue(value, path);
    const chatId = reader.readNonBlankString(Resources.chatIdField);
    const teammateId = Object.isNull(reader.readNullableString(Resources.teammateIdField)) ? null : reader.readNonBlankString(Resources.teammateIdField);
    if (reader.hasField(Resources.outsideField) && reader.readBoolean(Resources.outsideField)) {
      if (!Object.isNull(teammateId))
        throw new JsonException(Resources.outsideSenderWithTeammate, `${reader.path}.${Resources.teammateIdField}`);
      return new MessageSender(chatId, null, MessageSender.readOutsideLabel(reader), true);
    }
    return new MessageSender(chatId, teammateId, Object.isNull(teammateId) ? MessageSender.readDefaultName(reader) : TeammateName.read(reader));
  }

  public static allowsOutsideLabel(label: string): boolean {
    return label.trim().length > 0 && Resources.outsideLabelPattern.test(label);
  }

  public static allowsDefaultName(name: string): boolean {
    return name.trim().length > 0 && Resources.defaultSenderNamePattern.test(name.normalize(Resources.teammateNameNormalization));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.teammateIdField]: this.teammateId,
      [Resources.nameField]: this.name,
      ...(this.outside ? { [Resources.outsideField]: true } : {})
    };
  }

  private static validateOutsideLabel(label: string): void {
    if (!MessageSender.allowsOutsideLabel(label))
      throw new ArgumentException(Resources.invalidOutsideLabel, Resources.nameField);
  }

  private static readOutsideLabel(reader: JsonReader): string {
    const label = reader.readNonBlankString(Resources.nameField);
    if (!MessageSender.allowsOutsideLabel(label))
      throw new JsonException(Resources.invalidOutsideLabel, `${reader.path}.${Resources.nameField}`);
    return label;
  }

  private static validateDefaultName(name: string): void {
    if (!MessageSender.allowsDefaultName(name))
      throw new ArgumentException(Resources.invalidDefaultSenderName, Resources.nameField);
  }

  private static readDefaultName(reader: JsonReader): string {
    const name = reader.readNonBlankString(Resources.nameField);
    if (!MessageSender.allowsDefaultName(name))
      throw new JsonException(Resources.invalidDefaultSenderName, `${reader.path}.${Resources.nameField}`);
    return name;
  }
}
