/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ResizeObserverLoops } from "./fixtures/resize-observer-loops.fixture";

const loops = ResizeObserverLoops.shared;

afterEach(({ task }) => {
  expect(loops.take(), `"${task.name}" set off a ResizeObserver loop`).toEqual([]);
});
