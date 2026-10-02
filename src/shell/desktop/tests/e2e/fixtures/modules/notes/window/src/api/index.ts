/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPart } from "@noldova/teamrun-shell-window";

import { NotesWindowPart } from "../app/notes-window-part";

export const windowPart: IWindowPart = new NotesWindowPart();
