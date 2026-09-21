/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { NameofSelector } from "@noldova/teamrun-foundation-core";

export type ColumnSelector<TModel> = (t: NameofSelector<TModel>) => keyof TModel & string;
