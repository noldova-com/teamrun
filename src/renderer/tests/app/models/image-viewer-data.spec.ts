/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ImageSource } from "../../../src/app/models/image-source";
import { ImageViewerData } from "../../../src/app/models/image-viewer-data";

describe("ImageViewerData", () => {
  it("keeps the selected image and snapshots its navigation group", () => {
    const first = new ImageSource("1", "one.png", null, "data:first");
    const second = new ImageSource("2", "two.png", null, "data:second");
    const group = [first, second];
    const data = new ImageViewerData(second, group);
    group.pop();
    expect(data.index).toBe(1);
    expect(data.images).toEqual([first, second]);
    expect(new ImageViewerData(second).images).toEqual([second]);
    expect(new ImageViewerData(second, [first]).index).toBe(0);
  });
});
