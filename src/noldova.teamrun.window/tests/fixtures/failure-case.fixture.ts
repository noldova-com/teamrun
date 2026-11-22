/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MethodName } from "@noldova/teamrun.protocol";

import type { ChatStoreService } from "../../src/app/services/chat-store.service";

export class FailureCase {
  public readonly method: MethodName;
  public readonly act: (target: ChatStoreService) => Promise<unknown>;
  public readonly unchanged: (target: ChatStoreService) => void;

  public constructor(method: MethodName, act: (target: ChatStoreService) => Promise<unknown>, unchanged: (target: ChatStoreService) => void) {
    this.method = method;
    this.act = act;
    this.unchanged = unchanged;
  }
}
