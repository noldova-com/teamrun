/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "./json-object.js";

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;
