/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ITestName from "../../totals/interfaces/test-name.ts";
import type JsonFields from "../../totals/json-fields.ts";

export default interface IUiTest extends ITestName {
  readonly test: JsonFields;
}
