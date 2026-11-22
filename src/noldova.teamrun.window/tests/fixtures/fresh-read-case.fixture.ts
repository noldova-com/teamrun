/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ChatStoreService } from "../../src/app/services/chat-store.service";

export class FreshReadCase {
  public readonly name: string;
  public readonly act: (target: ChatStoreService) => Promise<boolean>;

  public constructor(name: string, act: (target: ChatStoreService) => Promise<boolean>) {
    this.name = name;
    this.act = act;
  }
}
