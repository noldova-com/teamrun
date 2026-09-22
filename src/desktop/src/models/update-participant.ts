/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { RuntimeClient, type InstallationMember, type RuntimeTimings } from "@noldova/teamrun-runtime";

import { Resources } from "../resources.js";

export class UpdateParticipant {
  public readonly member: InstallationMember;
  public readonly client: RuntimeClient;

  private constructor(member: InstallationMember, client: RuntimeClient) {
    this.member = member;
    this.client = client;
  }

  public static async connect(member: InstallationMember, timings: RuntimeTimings): Promise<UpdateParticipant> {
    if (Object.isNull(member.endpoint) || Object.isNull(member.token))
      throw new Error(Resources.updateWorkspaceNotReady);
    const client = await RuntimeClient.connect(member.endpoint, member.token, Resources.updateClientName,
      { onEvent: () => undefined, onDisconnected: () => undefined }, timings);
    return new UpdateParticipant(member, client);
  }

  public async call(method: string, payload: JsonValue, failureMessage: string): Promise<void> {
    try {
      const response = await this.client.call(method, payload);
      if (response.hasErrors)
        throw new Error(failureMessage);
    }
    catch (error) {
      throw new Error(failureMessage, { cause: error });
    }
  }
}
