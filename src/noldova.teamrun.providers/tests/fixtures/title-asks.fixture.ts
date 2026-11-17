/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert } from "@noldova/context.testing";
import { type IProviderAdapter, SharedMcpValues, TitleTurn, TurnRequest } from "@noldova/teamrun.core";

export class TitleAsks {
  public static isolated(request: TurnRequest): TurnRequest {
    return new TurnRequest(null, request.workingDirectory, request.prompt, request.requested, null, [], null, null, {}, false, null, [], null, undefined,
      SharedMcpValues.none, null, true);
  }

  public static async askAsync(adapter: IProviderAdapter, request: TurnRequest): Promise<string | null> {
    Assert.isDefined(adapter.askIsolated);
    return await TitleTurn.ask(adapter, request, new AbortController().signal);
  }

  public static async answerAsync(adapter: IProviderAdapter, request: TurnRequest): Promise<string> {
    const answer = await TitleAsks.askAsync(adapter, request);
    Assert.isNotNull(answer);
    return answer;
  }
}
