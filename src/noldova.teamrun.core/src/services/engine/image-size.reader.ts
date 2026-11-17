/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { closeSync, fstatSync, openSync, readSync } from "node:fs";

import "@noldova/context.core";

import { ImageSize } from "../../models/image-size.js";
import { Resources } from "../../resources.js";

export class ImageSizeReader {
  private static readonly LATIN1: BufferEncoding = "latin1";
  private static readonly HEAD_LENGTH: number = 32;
  private static readonly READ_CHUNK: number = 64 * 1024;
  private static readonly PNG_SIGNATURE: string = "\x89PNG\r\n\x1a\n";
  private static readonly PNG_HEADER: string = "IHDR";
  private static readonly GIF_SIGNATURES: readonly string[] = ["GIF87a", "GIF89a"];
  private static readonly RIFF: string = "RIFF";
  private static readonly WEBP: string = "WEBP";
  private static readonly VP8: string = "VP8 ";
  private static readonly VP8_START_CODE: string = "\x9d\x01\x2a";
  private static readonly VP8L: string = "VP8L";
  private static readonly VP8L_SIGNATURE: number = 0x2f;
  private static readonly VP8X: string = "VP8X";
  private static readonly FOURTEEN_BITS: number = 0x3fff;
  private static readonly JPEG_MARKER: number = 0xff;
  private static readonly JPEG_START: number = 0xd8;
  private static readonly JPEG_SCAN: number = 0xda;
  private static readonly JPEG_END: number = 0xd9;
  private static readonly JPEG_EXIF: number = 0xe1;
  private static readonly JPEG_FRAMES: readonly number[] = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];
  private static readonly EXIF_HEADER: string = "Exif\0\0";
  private static readonly TIFF_LITTLE_ENDIAN: string = "II";
  private static readonly ORIENTATION_TAG: number = 0x0112;
  private static readonly ROTATED_ORIENTATIONS: readonly number[] = [5, 6, 7, 8];
  private static readonly PNG_MEDIA_TYPE: string = "image/png";
  private static readonly GIF_MEDIA_TYPE: string = "image/gif";
  private static readonly WEBP_MEDIA_TYPE: string = "image/webp";
  private static readonly JPEG_MEDIA_TYPE: string = "image/jpeg";
  private static readonly SVG_MEDIA_TYPE: string = "image/svg+xml";
  private static readonly UTF8: BufferEncoding = "utf8";
  private static readonly SVG_ROOT: RegExp =
    /^\s*(?:<\?xml[^>]*\?>\s*)?(?:(?:<!--(?:[^-]|-[^-])*-->|<!DOCTYPE[^>[]*(?:\[[^\]]*\])?\s*>)\s*)*<svg[\s/>]/;

  public static readBuffer(data: Buffer): ImageSize | null {
    return ImageSizeReader.read((offset, length) => data.subarray(offset, offset + length));
  }

  public static mediaTypeOf(data: Buffer): string | null {
    const bytes = (offset: number, length: number): Buffer => data.subarray(offset, offset + length);
    const head = bytes(0, ImageSizeReader.HEAD_LENGTH);
    const kinds: readonly (readonly [string, ImageSize | null])[] = [[ImageSizeReader.PNG_MEDIA_TYPE, ImageSizeReader.png(head)],
      [ImageSizeReader.GIF_MEDIA_TYPE, ImageSizeReader.gif(head)], [ImageSizeReader.WEBP_MEDIA_TYPE, ImageSizeReader.webp(head)],
      [ImageSizeReader.JPEG_MEDIA_TYPE, ImageSizeReader.jpeg(head, bytes)]];
    return kinds.find(([, size]) => !Object.isNull(size) && size.width >= 1 && size.height >= 1)?.[0]
      ?? (ImageSizeReader.SVG_ROOT.test(bytes(0, ImageSizeReader.READ_CHUNK).toString(ImageSizeReader.UTF8)) ? ImageSizeReader.SVG_MEDIA_TYPE : null);
  }

  public static readFile(path: string): ImageSize | null {
    const file = openSync(path, Resources.nonBlockingReadFlags);
    try {
      let start = 0;
      let chunk = Buffer.alloc(0);
      return !fstatSync(file).isFile() ? null : ImageSizeReader.read((offset, length) => {
        if (offset < start || offset + length > start + chunk.length) {
          const buffer = Buffer.alloc(Math.max(length, ImageSizeReader.READ_CHUNK));
          chunk = buffer.subarray(0, readSync(file, buffer, 0, buffer.length, offset));
          start = offset;
        }
        return chunk.subarray(offset - start, offset - start + length);
      });
    }
    finally {
      closeSync(file);
    }
  }

  private static read(bytes: (offset: number, length: number) => Buffer): ImageSize | null {
    const head = bytes(0, ImageSizeReader.HEAD_LENGTH);
    const size = ImageSizeReader.png(head) ?? ImageSizeReader.gif(head) ?? ImageSizeReader.webp(head) ?? ImageSizeReader.jpeg(head, bytes);
    return Object.isNull(size) || size.width < 1 || size.height < 1 ? null : size;
  }

  private static png(head: Buffer): ImageSize | null {
    if (head.length < 24 || head.toString(ImageSizeReader.LATIN1, 0, 8) !== ImageSizeReader.PNG_SIGNATURE
      || head.toString(ImageSizeReader.LATIN1, 12, 16) !== ImageSizeReader.PNG_HEADER)
      return null;
    return new ImageSize(head.readUInt32BE(16), head.readUInt32BE(20));
  }

  private static gif(head: Buffer): ImageSize | null {
    if (head.length < 10 || !ImageSizeReader.GIF_SIGNATURES.includes(head.toString(ImageSizeReader.LATIN1, 0, 6)))
      return null;
    return new ImageSize(head.readUInt16LE(6), head.readUInt16LE(8));
  }

  private static webp(head: Buffer): ImageSize | null {
    if (head.length < 30 || head.toString(ImageSizeReader.LATIN1, 0, 4) !== ImageSizeReader.RIFF
      || head.toString(ImageSizeReader.LATIN1, 8, 12) !== ImageSizeReader.WEBP)
      return null;
    const chunk = head.toString(ImageSizeReader.LATIN1, 12, 16);
    if (chunk === ImageSizeReader.VP8X)
      return new ImageSize(head.readUIntLE(24, 3) + 1, head.readUIntLE(27, 3) + 1);
    if (chunk === ImageSizeReader.VP8L && head[20] === ImageSizeReader.VP8L_SIGNATURE) {
      const bits = head.readUInt32LE(21);
      return new ImageSize((bits & ImageSizeReader.FOURTEEN_BITS) + 1, ((bits >>> 14) & ImageSizeReader.FOURTEEN_BITS) + 1);
    }
    if (chunk === ImageSizeReader.VP8 && head.toString(ImageSizeReader.LATIN1, 23, 26) === ImageSizeReader.VP8_START_CODE)
      return new ImageSize(head.readUInt16LE(26) & ImageSizeReader.FOURTEEN_BITS, head.readUInt16LE(28) & ImageSizeReader.FOURTEEN_BITS);
    return null;
  }

  private static jpeg(head: Buffer, bytes: (offset: number, length: number) => Buffer): ImageSize | null {
    if (head.length < 4 || head[0] !== ImageSizeReader.JPEG_MARKER || head[1] !== ImageSizeReader.JPEG_START)
      return null;
    let rotated = false;
    let offset = 2;
    for (let segment = bytes(offset, 4); segment.length === 4; segment = bytes(offset, 4)) {
      const marker = segment[1]!;
      if (segment[0] !== ImageSizeReader.JPEG_MARKER || marker === ImageSizeReader.JPEG_SCAN || marker === ImageSizeReader.JPEG_END)
        return null;
      if (marker === ImageSizeReader.JPEG_MARKER) {
        offset += 1;
        continue;
      }
      const length = segment.readUInt16BE(2);
      if (ImageSizeReader.JPEG_FRAMES.includes(marker)) {
        const frame = bytes(offset, 9);
        if (frame.length < 9)
          return null;
        const width = frame.readUInt16BE(7);
        const height = frame.readUInt16BE(5);
        return rotated ? new ImageSize(height, width) : new ImageSize(width, height);
      }
      if (marker === ImageSizeReader.JPEG_EXIF)
        rotated = ImageSizeReader.isRotated(bytes(offset + 4, Math.max(length - 2, 0)));
      offset += 2 + Math.max(length, 2);
    }
    return null;
  }

  private static isRotated(segment: Buffer): boolean {
    if (segment.length < 14 || segment.toString(ImageSizeReader.LATIN1, 0, 6) !== ImageSizeReader.EXIF_HEADER)
      return false;
    const tiff = segment.subarray(6);
    const little = tiff.toString(ImageSizeReader.LATIN1, 0, 2) === ImageSizeReader.TIFF_LITTLE_ENDIAN;
    const read16 = (at: number): number => little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at);
    const directory = little ? tiff.readUInt32LE(4) : tiff.readUInt32BE(4);
    if (directory + 2 > tiff.length)
      return false;
    for (let entry = directory + 2, count = read16(directory); count > 0 && entry + 12 <= tiff.length; entry += 12, count--) {
      if (read16(entry) === ImageSizeReader.ORIENTATION_TAG)
        return ImageSizeReader.ROTATED_ORIENTATIONS.includes(read16(entry + 8));
    }
    return false;
  }
}
