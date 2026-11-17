/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Resources } from "../../resources";
import { ImageDimensions } from "./image-dimensions";

export class ImageHeader {
  private static readonly jpegFrameMarkers: ReadonlySet<number> = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  private static readonly jpegBareMarkers: ReadonlySet<number> = new Set([0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8]);

  public static sizeOf(mediaType: string, data: string): ImageDimensions | null {
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(data.slice(0, Math.ceil(Resources.imageHeaderBytes / 3) * 4)), t => t.charCodeAt(0));
    }
    catch {
      return null;
    }
    switch (mediaType) {
      case Resources.pngMediaType:
        return ImageHeader.pngSizeOf(bytes);
      case Resources.gifMediaType:
        return ImageHeader.gifSizeOf(bytes);
      case Resources.webpMediaType:
        return ImageHeader.webpSizeOf(bytes);
      case Resources.jpegMediaType:
        return ImageHeader.jpegSizeOf(bytes);
      default:
        return null;
    }
  }

  private static pngSizeOf(bytes: Uint8Array): ImageDimensions | null {
    if (bytes.length < 24 || !ImageHeader.startsWith(bytes, 0, Resources.pngSignature) || !ImageHeader.startsWith(bytes, 12, Resources.pngHeaderChunk))
      return null;
    return ImageHeader.dimensions(ImageHeader.bigEndian(bytes, 16, 4), ImageHeader.bigEndian(bytes, 20, 4));
  }

  private static gifSizeOf(bytes: Uint8Array): ImageDimensions | null {
    if (bytes.length < 10 || !ImageHeader.startsWith(bytes, 0, Resources.gifSignature))
      return null;
    return ImageHeader.dimensions(ImageHeader.littleEndian(bytes, 6, 2), ImageHeader.littleEndian(bytes, 8, 2));
  }

  private static webpSizeOf(bytes: Uint8Array): ImageDimensions | null {
    if (bytes.length < 30 || !ImageHeader.startsWith(bytes, 0, Resources.riffSignature) || !ImageHeader.startsWith(bytes, 8, Resources.webpSignature))
      return null;
    if (ImageHeader.startsWith(bytes, 12, Resources.webpLossyChunk))
      return ImageHeader.dimensions(ImageHeader.littleEndian(bytes, 26, 2) & 0x3fff, ImageHeader.littleEndian(bytes, 28, 2) & 0x3fff);
    if (ImageHeader.startsWith(bytes, 12, Resources.webpLosslessChunk))
      return ImageHeader.dimensions(1 + (((bytes[22]! & 0x3f) << 8) | bytes[21]!), 1 + (((bytes[24]! & 0x0f) << 10) | (bytes[23]! << 2) | ((bytes[22]! & 0xc0) >> 6)));
    if (ImageHeader.startsWith(bytes, 12, Resources.webpExtendedChunk))
      return ImageHeader.dimensions(1 + ImageHeader.littleEndian(bytes, 24, 3), 1 + ImageHeader.littleEndian(bytes, 27, 3));
    return null;
  }

  private static jpegSizeOf(bytes: Uint8Array): ImageDimensions | null {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
      return null;
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff)
        return null;
      const marker = bytes[offset + 1]!;
      if (marker === 0xff)
        offset += 1;
      else if (ImageHeader.jpegFrameMarkers.has(marker))
        return ImageHeader.dimensions(ImageHeader.bigEndian(bytes, offset + 7, 2), ImageHeader.bigEndian(bytes, offset + 5, 2));
      else if (ImageHeader.jpegBareMarkers.has(marker))
        offset += 2;
      else
        offset += 2 + ImageHeader.bigEndian(bytes, offset + 2, 2);
    }
    return null;
  }

  private static dimensions(width: number, height: number): ImageDimensions | null {
    return width > 0 && height > 0 ? new ImageDimensions(width, height) : null;
  }

  private static startsWith(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
    return expected.every((t, i) => bytes[offset + i] === t);
  }

  private static bigEndian(bytes: Uint8Array, offset: number, length: number): number {
    let value = 0;
    for (let i = 0; i < length; i++)
      value = value * 256 + bytes[offset + i]!;
    return value;
  }

  private static littleEndian(bytes: Uint8Array, offset: number, length: number): number {
    let value = 0;
    for (let i = length - 1; i >= 0; i--)
      value = value * 256 + bytes[offset + i]!;
    return value;
  }
}
