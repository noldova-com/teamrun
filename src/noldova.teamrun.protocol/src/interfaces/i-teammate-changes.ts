/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Harness } from "../enums/harness.js";
import type { TeammateFallback } from "../models/teammate-fallback.js";

export interface ITeammateChanges {
  readonly name?: string;
  readonly role?: string | null;
  readonly providerId?: string;
  readonly harness?: Harness;
  readonly model?: string | null;
  readonly effort?: string | null;
  readonly speed?: string | null;
  readonly mode?: string | null;
  readonly contextWindow?: number | null;
  readonly usageHandOffs?: readonly string[];
  readonly sustain?: boolean;
  readonly fallbacks?: readonly TeammateFallback[];
  readonly resetsSoonestFirst?: boolean;
}
