/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProviderAccount, ProviderDescriptor, ProviderModel } from "@noldova/teamrun-protocol";

import type { ForkRequest } from "../models/fork-request.js";
import type { SignInCheck } from "../models/sign-in-check.js";
import type { TurnRequest } from "../models/turn-request.js";
import type { TurnResult } from "../models/turn-result.js";
import type { ITurnListener } from "./i-turn-listener.js";

export interface IProviderAdapter {
  readonly descriptor: ProviderDescriptor;

  checkSignIn(account: ProviderAccount): Promise<SignInCheck>;
  listModels(account: ProviderAccount | null): Promise<readonly ProviderModel[]>;
  runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult>;
  forkSession(request: ForkRequest): Promise<string>;
  shutdown(): Promise<void>;
}
