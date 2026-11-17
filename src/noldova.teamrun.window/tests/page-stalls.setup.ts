/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageStalls } from "./fixtures/page-stalls.fixture";

beforeEach(({ task, onTestFailed }) => {
  const stalls = PageStalls.shared;
  const started = stalls.elapsed();
  onTestFailed(() => console.error(`The page while "${task.name}" ran: ${stalls.during(started, stalls.elapsed())}.`));
});
