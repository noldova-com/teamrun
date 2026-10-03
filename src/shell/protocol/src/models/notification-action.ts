/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { CommandRun } from "./command-run.js";

export class NotificationAction {
  private static readonly FIELDS: readonly string[] = [Resources.titleField, Resources.commandField];

  public readonly title: string;
  public readonly command: CommandRun;

  public constructor(title: string, command: CommandRun) {
    if (String.isNullOrWhitespace(title))
      throw new ArgumentException(Resources.notificationActionTitleInvalid, Resources.titleField);

    this.title = title;
    this.command = command;
  }

  public static fromJson(value: unknown, path?: string): NotificationAction {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, NotificationAction.FIELDS);
    return WireContract.create(reader, () => {
      const command = reader.readObject(Resources.commandField);
      return new NotificationAction(reader.readString(Resources.titleField), CommandRun.fromJson(command.toJson(), command.path));
    });
  }

  public toJson(): JsonObject {
    return { [Resources.titleField]: this.title, [Resources.commandField]: this.command.toJson() };
  }
}
