/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IToolDescriptor, ToolRisk } from "@noldova/desktop.runtime";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { SubAgentStartParams, SubAgentStopParams, SubAgentWaitParams } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";

export class SubAgentTools {
  private static readonly DEADLINE: number = 30_000;
  private static readonly WAIT_DEADLINE: number = 60_000;
  private static readonly MAXIMUM_DEADLINE: number = 120_000;
  private static readonly WAIT_SECONDS: number = 30;
  private static readonly MAXIMUM_WAIT_SECONDS: number = 50;

  public static readonly start: IToolDescriptor = {
    ...SubAgentTools.descriptor(Resources.startSubAgentTool, Resources.startSubAgentTitle, Resources.startSubAgentDescription, {
      [Resources.agentArgument]: { type: "string", enum: [Resources.explorerAgent, Resources.helperAgent], description: Resources.agentDescription },
      [Resources.descriptionArgument]: SubAgentTools.text(Resources.subAgentDescriptionDescription),
      [Resources.briefArgument]: SubAgentTools.text(Resources.briefDescription)
    }, [Resources.agentArgument, Resources.descriptionArgument, Resources.briefArgument], false),
    nextTool: Resources.waitSubAgentsTool
  };

  public static readonly wait: IToolDescriptor = {
    ...SubAgentTools.descriptor(Resources.waitSubAgentsTool, Resources.waitSubAgentsTitle, Resources.waitSubAgentsDescription, {
      [Resources.subAgentIdsArgument]: { type: "array", items: SubAgentTools.text(Resources.subAgentIdDescription), description: Resources.subAgentIdsDescription },
      [Resources.secondsArgument]: {
        type: "integer", minimum: 0, maximum: SubAgentTools.MAXIMUM_WAIT_SECONDS, default: SubAgentTools.WAIT_SECONDS, description: Resources.secondsDescription
      }
    }, [], true),
    deadline: { default: SubAgentTools.WAIT_DEADLINE, maximum: SubAgentTools.MAXIMUM_DEADLINE }
  };

  public static readonly stop: IToolDescriptor = {
    ...SubAgentTools.descriptor(Resources.stopSubAgentTool, Resources.stopSubAgentTitle, Resources.stopSubAgentDescription,
      { [Resources.subAgentIdArgument]: SubAgentTools.text(Resources.subAgentIdDescription) }, [Resources.subAgentIdArgument], false),
    nextTool: Resources.waitSubAgentsTool
  };

  public static readonly all: readonly IToolDescriptor[] = [SubAgentTools.start, SubAgentTools.wait, SubAgentTools.stop];

  public static startParamsOf(input: JsonObject, token: string): JsonObject {
    const reader = JsonReader.fromValue(input);
    return new SubAgentStartParams(token, reader.readString(Resources.agentArgument), reader.readString(Resources.descriptionArgument),
      reader.readString(Resources.briefArgument)).toJson();
  }

  public static waitParamsOf(input: JsonObject, token: string): JsonObject {
    const reader = JsonReader.fromValue(input);
    return new SubAgentWaitParams(token, reader.hasField(Resources.subAgentIdsArgument) ? reader.readStringArray(Resources.subAgentIdsArgument) : [],
      reader.hasField(Resources.secondsArgument) ? reader.readInteger(Resources.secondsArgument) : SubAgentTools.WAIT_SECONDS).toJson();
  }

  public static stopParamsOf(input: JsonObject, token: string): JsonObject {
    return new SubAgentStopParams(token, JsonReader.fromValue(input).readString(Resources.subAgentIdArgument)).toJson();
  }

  private static descriptor(name: string, title: string, description: string, properties: JsonObject, required: readonly string[],
    isReadOnly: boolean): IToolDescriptor {
    return {
      name,
      title,
      description,
      inputSchema: { type: "object", properties, required: [...required], additionalProperties: false },
      hints: { isReadOnly, isDestructive: false, isOpenWorld: false },
      risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
      marksSending: !isReadOnly,
      deadline: { default: SubAgentTools.DEADLINE, maximum: SubAgentTools.MAXIMUM_DEADLINE }
    };
  }

  private static text(description: string): JsonObject {
    return { type: "string", minLength: 1, description };
  }
}
