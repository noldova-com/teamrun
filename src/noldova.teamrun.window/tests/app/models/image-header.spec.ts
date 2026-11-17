/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ImageDimensions } from "../../../src/app/models/image-dimensions";
import { ImageHeader } from "../../../src/app/models/image-header";
import { ImageHeaders } from "../../fixtures/image-headers.fixture";

describe("ImageHeader", () => {
  const spliced = (data: string, offset: number, removed: number, ...bytes: number[]): string => {
    const decoded = [...atob(data)].map(t => t.charCodeAt(0));
    decoded.splice(offset, removed, ...bytes);
    return btoa(String.fromCharCode(...decoded));
  };
  const cut = (data: string, length: number): string => btoa(atob(data).slice(0, length));

  it("reads each format's size from its header, past a JPEG's fill bytes, bare markers and other segments", () => {
    const cases: readonly [string, string][] = [["image/png", ImageHeaders.png(600, 300)], ["image/gif", ImageHeaders.gif(600, 300)],
      ["image/webp", ImageHeaders.lossyWebp(600, 300)], ["image/webp", ImageHeaders.losslessWebp(600, 300)], ["image/webp", ImageHeaders.extendedWebp(600, 300)],
      ["image/jpeg", ImageHeaders.jpeg(600, 300)], ["image/jpeg", spliced(ImageHeaders.jpeg(600, 300), 2, 0, 0xff, 0xd0)]];

    expect(cases.map(([mediaType, data]) => ImageHeader.sizeOf(mediaType, data))).toEqual(cases.map(() => new ImageDimensions(600, 300)));
  });

  it("reads no size from data that isn't base64 or of a type it doesn't read", () => {
    expect(ImageHeader.sizeOf("image/png", "%%%%")).toBeNull();
    expect(ImageHeader.sizeOf("image/bmp", ImageHeaders.png(600, 300))).toBeNull();
  });

  it("reads no size from a header that is cut short, has the wrong signature or chunk, or gives no size", () => {
    const png = ImageHeaders.png(600, 300);
    const gif = ImageHeaders.gif(600, 300);
    const webp = ImageHeaders.lossyWebp(600, 300);
    const jpeg = ImageHeaders.jpeg(600, 300);
    const cases: readonly [string, string][] = [
      ["image/png", cut(png, 23)], ["image/png", spliced(png, 0, 1, 0x88)], ["image/png", spliced(png, 12, 1, 0x69)], ["image/png", ImageHeaders.png(0, 300)],
      ["image/gif", cut(gif, 9)], ["image/gif", spliced(gif, 0, 1, 0x48)], ["image/gif", ImageHeaders.gif(600, 0)],
      ["image/webp", cut(webp, 29)], ["image/webp", spliced(webp, 0, 1, 0x51)], ["image/webp", spliced(webp, 8, 1, 0x58)], ["image/webp", spliced(webp, 15, 1, 0x51)],
      ["image/jpeg", cut(jpeg, 3)], ["image/jpeg", spliced(jpeg, 0, 1, 0)], ["image/jpeg", spliced(jpeg, 1, 1, 0xd9)], ["image/jpeg", spliced(jpeg, 2, 1, 0)],
      ["image/jpeg", cut(jpeg, 30)], ["image/jpeg", ImageHeaders.jpeg(0, 300)]];

    expect(cases.map(([mediaType, data]) => ImageHeader.sizeOf(mediaType, data))).toEqual(cases.map(() => null));
  });
});
