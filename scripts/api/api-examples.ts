/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ApiExample from "./api-example.ts";

export default class ApiExamples {
  public readonly examples: readonly ApiExample[];
  public readonly undocumented: readonly string[];

  public constructor(examples: readonly ApiExample[], undocumented: readonly string[]) {
    this.examples = [...examples];
    this.undocumented = [...undocumented];
  }
}
