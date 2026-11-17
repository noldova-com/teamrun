/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { type ITurnListener, TurnDetail } from "@noldova/teamrun.core";
import { DetailKind } from "@noldova/teamrun.protocol";

import { AcpSession } from "../../models/acp-session.js";
import { Resources } from "../../resources.js";
import { FailureDescriber } from "../failure-describer.js";
import type { AcpClient } from "./acp-client.js";

export class AcpSessionOpener {
  public static async open(client: AcpClient, params: Record<string, JsonValue>, resumeId: string | null, listener: ITurnListener,
    signal: AbortSignal, timeout: number, reopen: (failure: unknown) => Promise<AcpClient>, resume: boolean = false, startsNew: boolean = true): Promise<AcpSession | null> {
    let current = client;
    if (!Object.isNull(resumeId)) {
      try {
        const loaded = await current.request(resume ? Resources.acpSessionResume : Resources.acpSessionLoad, { ...params, [Resources.sessionIdField]: resumeId }, timeout);
        return new AcpSession(resumeId, true, JsonReader.fromValue(loaded));
      }
      catch (error) {
        if (signal.aborted)
          throw error;
        if (!startsNew)
          return null;
        if (!current.isConnected)
          current = await reopen(error);
        await listener.onDetailAsync(new TurnDetail(DetailKind.Note, Resources.formatResumeFailed(FailureDescriber.describe(error)), Resources.resumeNotePayload, null));
      }
    }
    if (!startsNew)
      return null;
    const started = JsonReader.fromValue(await current.request(Resources.acpSessionNew, params, timeout));
    return new AcpSession(started.readNonBlankString(Resources.sessionIdField), false, started);
  }
}
