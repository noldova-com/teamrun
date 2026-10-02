/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChildProcessStarter, type IProcessStarter } from "@noldova/teamrun-shell-runtime";

import type { IParentPort } from "../interfaces/i-parent-port.js";
import { DetachedStartReply } from "../models/detached-start-reply.js";
import { DetachedStartRequest } from "../models/detached-start-request.js";

export class DetachedStart {
  public static async runAsync(message: unknown, port: IParentPort, starter: IProcessStarter = new ChildProcessStarter()): Promise<void> {
    let reply: DetachedStartReply;
    try {
      const request = DetachedStartRequest.fromJson(message);
      reply = DetachedStartReply.started(await starter.startAsync(request.executable, request.launchArguments, request.environment, request.errorFile));
    }
    catch (error) {
      reply = DetachedStartReply.failed(String(error));
    }
    port.postMessage(reply.toJson());
  }
}
