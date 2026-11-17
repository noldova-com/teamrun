/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class SenderEnvironment {
  public static of(token: string): Readonly<Record<string, string>> {
    return { [Resources.senderTokenVariable]: token };
  }

  public static read(environment: Readonly<Record<string, string | undefined>>): string | null {
    return environment[Resources.senderTokenVariable] ?? null;
  }
}
