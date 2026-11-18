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
  expect(loops.take(), `"${task.name}" or the test before it set off a ResizeObserver loop`).toEqual([]);
});

afterAll(async () => {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  expect(loops.take(), "this file's last test set off a ResizeObserver loop the page reported after it ended").toEqual([]);
});
