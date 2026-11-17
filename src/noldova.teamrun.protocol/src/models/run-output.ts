/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class RunOutput {
  public readonly chatId: string;
  public readonly messageId: string;
  public readonly site: string;
  public readonly block: number;
  public readonly output: JsonObject;

  public constructor(chatId: string, messageId: string, site: string, block: number, output: JsonObject) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(messageId, Resources.messageIdField);
    ArgumentException.throwIfNullOrWhitespace(site, Resources.siteField);
    if (!Number.isInteger(block) || block < 0)
      throw new ArgumentOutOfRangeException(Resources.blockField, block);

    this.chatId = chatId;
    this.messageId = messageId;
    this.site = site;
    this.block = block;
    this.output = JsonReader.parse(JSON.stringify(output)).toJson();
  }

  public static fromJson(value: unknown, path?: string): RunOutput {
    const reader = JsonReader.fromValue(value, path);
    return new RunOutput(
      reader.readNonBlankString(Resources.chatIdField),
      reader.readNonBlankString(Resources.messageIdField),
      reader.readNonBlankString(Resources.siteField),
      reader.readInteger(Resources.blockField),
      reader.readObject(Resources.outputField).toJson());
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.messageIdField]: this.messageId,
      [Resources.siteField]: this.site,
      [Resources.blockField]: this.block,
      [Resources.outputField]: JsonReader.parse(JSON.stringify(this.output)).toJson()
    };
  }
}
