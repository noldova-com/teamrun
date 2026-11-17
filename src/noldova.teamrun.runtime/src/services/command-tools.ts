/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IToolDescriptor, ToolRisk } from "@noldova/desktop.runtime";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { CommandStartParams, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";

export class CommandTools {
  private static readonly DEADLINE: number = 30_000;
  private static readonly MAXIMUM_DEADLINE: number = 120_000;

  public static readonly run: IToolDescriptor = {
    name: Resources.runInBackgroundTool,
    title: Resources.runInBackgroundTitle,
    description: Resources.runInBackgroundDescription,
    inputSchema: {
      type: "object",
      properties: {
        [Resources.commandArgument]: {
          type: "string", minLength: 1, maxLength: ProtocolResources.maximumCommandLength, description: Resources.commandDescription
        },
        [Resources.descriptionArgument]: { type: "string", minLength: 1, description: Resources.commandDescriptionDescription }
      },
      required: [Resources.commandArgument, Resources.descriptionArgument],
      additionalProperties: false
    },
    hints: { isReadOnly: false, isDestructive: true, isOpenWorld: true },
    risk: { default: ToolRisk.High, maximum: ToolRisk.High },
    marksSending: true,
    deadline: { default: CommandTools.DEADLINE, maximum: CommandTools.MAXIMUM_DEADLINE },
    nextTool: Resources.listMessagesTool
  };

  public static runParamsOf(input: JsonObject, token: string): JsonObject {
    const reader = JsonReader.fromValue(input);
    return new CommandStartParams(token, reader.readString(Resources.commandArgument), reader.readString(Resources.descriptionArgument)).toJson();
  }
}
