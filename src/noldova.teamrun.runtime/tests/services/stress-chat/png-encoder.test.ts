/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { crc32, inflateSync } from "node:zlib";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PngEncoder, StressChatImage } from "@noldova/teamrun.runtime/development";

@TestClass
export class PngEncoderTests {
  @TestMethod
  public encodesAnOpaqueGradientInBandsThatRepeatTheirFirstRow(): void {
    const png = new PngEncoder().encode(new StressChatImage("opaque.png", 10, 16, false));
    const chunks = PngEncoderTests.readChunks(png);
    const rows = inflateSync(PngEncoderTests.dataOf(chunks, "IDAT"));
    const header = PngEncoderTests.dataOf(chunks, "IHDR");

    Assert.areEqual("137,80,78,71,13,10,26,10", [...png.subarray(0, 8)].join(","));
    Assert.areEqual("IHDR,IDAT,IEND", chunks.map(t => t.type).join(","));
    Assert.isTrue(chunks.every(t => t.isChecked));
    Assert.areEqual(10, header.readUInt32BE(0));
    Assert.areEqual(16, header.readUInt32BE(4));
    Assert.areEqual("8,2,0,0,0", [...header.subarray(8)].join(","));
    Assert.areEqual(31 * 16, rows.length);
    Assert.areEqual("0,0,0,255", [...rows.subarray(0, 4)].join(","));
    Assert.areEqual("128,0,127", [...rows.subarray(16, 19)].join(","));
    Assert.areEqual(2, rows[31]);
    Assert.isTrue(rows.subarray(32, 62).every(t => t === 0));
    Assert.areEqual("0,0,32,255", [...rows.subarray(62, 66)].join(","));
    Assert.areEqual("0,0,223,255", [...rows.subarray(31 * 14, 31 * 14 + 4)].join(","));
    Assert.areEqual(0, PngEncoderTests.dataOf(chunks, "IEND").length);
  }

  @TestMethod
  public encodesATransparentGradientThatFadesInAcross(): void {
    const chunks = PngEncoderTests.readChunks(new PngEncoder().encode(new StressChatImage("transparent.png", 4, 8, true)));
    const rows = inflateSync(PngEncoderTests.dataOf(chunks, "IDAT"));

    Assert.areEqual("8,6,0,0,0", [...PngEncoderTests.dataOf(chunks, "IHDR").subarray(8)].join(","));
    Assert.areEqual(17 * 8, rows.length);
    Assert.areEqual("0,0,0,255,0", [...rows.subarray(0, 5)].join(","));
    Assert.areEqual("128,0,127,128", [...rows.subarray(9, 13)].join(","));
    Assert.areEqual("0,0,223,255,0", [...rows.subarray(17 * 7, 17 * 7 + 5)].join(","));
  }

  private static readChunks(png: Buffer): { type: string; data: Buffer; isChecked: boolean }[] {
    const chunks: { type: string; data: Buffer; isChecked: boolean }[] = [];
    for (let offset = 8; offset < png.length;) {
      const length = png.readUInt32BE(offset);
      const body = png.subarray(offset + 4, offset + 8 + length);
      chunks.push({ type: body.subarray(0, 4).toString("ascii"), data: body.subarray(4), isChecked: png.readUInt32BE(offset + 8 + length) === crc32(body) });
      offset += 12 + length;
    }
    return chunks;
  }

  private static dataOf(chunks: readonly { type: string; data: Buffer }[], type: string): Buffer {
    return chunks.find(t => t.type === type)?.data ?? Buffer.alloc(0);
  }
}
