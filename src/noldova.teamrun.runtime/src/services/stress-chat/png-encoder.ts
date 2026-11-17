/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { crc32, deflateSync } from "node:zlib";

import type { StressChatImage } from "../../models/stress-chat/stress-chat-image.js";
import { StressChatResources } from "./stress-chat-resources.js";

export class PngEncoder {
  public encode(image: StressChatImage): Buffer {
    const channels = image.isTransparent ? StressChatResources.colorWithAlphaChannels : StressChatResources.colorChannels;
    const stride = image.width * channels + 1;
    const rows = Buffer.alloc(stride * image.height);
    const bandHeight = Math.ceil(image.height / StressChatResources.imageBands);
    for (let y = 0; y < image.height; y++) {
      if (y % bandHeight === 0)
        PngEncoder.paintRow(rows, y * stride, image, channels, y / bandHeight);
      else
        rows[y * stride] = StressChatResources.pngUpFilter;
    }

    const header = Buffer.alloc(StressChatResources.pngHeaderLength);
    header.writeUInt32BE(image.width, 0);
    header.writeUInt32BE(image.height, 4);
    header[8] = StressChatResources.pngBitDepth;
    header[9] = image.isTransparent ? StressChatResources.pngTruecolorWithAlpha : StressChatResources.pngTruecolor;
    return Buffer.concat([
      Buffer.from(StressChatResources.pngSignature),
      PngEncoder.chunk(StressChatResources.pngHeaderChunk, header),
      PngEncoder.chunk(StressChatResources.pngDataChunk, deflateSync(rows)),
      PngEncoder.chunk(StressChatResources.pngEndChunk, Buffer.alloc(0))
    ]);
  }

  private static paintRow(rows: Buffer, offset: number, image: StressChatImage, channels: number, band: number): void {
    const green = Math.round(StressChatResources.channelMaximum * band / StressChatResources.imageBands);
    for (let x = 0; x < image.width; x++) {
      const pixel = offset + 1 + x * channels;
      const across = Math.round(StressChatResources.channelMaximum * x / image.width);
      rows[pixel] = across;
      rows[pixel + 1] = green;
      rows[pixel + 2] = StressChatResources.channelMaximum - across;
      if (image.isTransparent)
        rows[pixel + 3] = across;
    }
  }

  private static chunk(type: string, data: Buffer): Buffer {
    const body = Buffer.concat([Buffer.from(type, StressChatResources.asciiEncoding), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const check = Buffer.alloc(4);
    check.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([length, body, check]);
  }
}
