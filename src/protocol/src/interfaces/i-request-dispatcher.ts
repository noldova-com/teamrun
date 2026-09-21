/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Request } from "../models/request.js";
import type { Response } from "../models/response.js";

export interface IRequestDispatcher {
  dispatch(request: Request): Promise<Response>;
}
