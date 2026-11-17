/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ImageHeaders {
  public static png(width: number, height: number): string {
    return ImageHeaders.base64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...ImageHeaders.bigEndian(13, 4), ...ImageHeaders.ascii("IHDR"),
      ...ImageHeaders.bigEndian(width, 4), ...ImageHeaders.bigEndian(height, 4)]);
  }

  public static gif(width: number, height: number): string {
    return ImageHeaders.base64([...ImageHeaders.ascii("GIF89a"), ...ImageHeaders.littleEndian(width, 2), ...ImageHeaders.littleEndian(height, 2)]);
  }

  public static lossyWebp(width: number, height: number): string {
    return ImageHeaders.webp("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, ...ImageHeaders.littleEndian(width, 2), ...ImageHeaders.littleEndian(height, 2)]);
  }

  public static losslessWebp(width: number, height: number): string {
    return ImageHeaders.webp("VP8L", [0x2f, ...ImageHeaders.littleEndian((width - 1) + (height - 1) * 2 ** 14, 4), 0, 0, 0, 0, 0]);
  }

  public static extendedWebp(width: number, height: number): string {
    return ImageHeaders.webp("VP8X", [0, 0, 0, 0, ...ImageHeaders.littleEndian(width - 1, 3), ...ImageHeaders.littleEndian(height - 1, 3)]);
  }

  public static jpeg(width: number, height: number): string {
    return ImageHeaders.base64([0xff, 0xd8, 0xff, 0xe0, ...ImageHeaders.bigEndian(16, 2), ...new Array<number>(14).fill(0), 0xff, 0xff,
      0xff, 0xc2, ...ImageHeaders.bigEndian(17, 2), 8, ...ImageHeaders.bigEndian(height, 2), ...ImageHeaders.bigEndian(width, 2), ...new Array<number>(12).fill(0)]);
  }

  private static webp(chunk: string, body: readonly number[]): string {
    return ImageHeaders.base64([...ImageHeaders.ascii("RIFF"), 0, 0, 0, 0, ...ImageHeaders.ascii("WEBP"), ...ImageHeaders.ascii(chunk), 0, 0, 0, 0, ...body]);
  }

  private static base64(bytes: readonly number[]): string {
    return btoa(String.fromCharCode(...bytes));
  }

  private static ascii(text: string): number[] {
    return [...text].map(t => t.charCodeAt(0));
  }

  private static bigEndian(value: number, length: number): number[] {
    return ImageHeaders.littleEndian(value, length).reverse();
  }

  private static littleEndian(value: number, length: number): number[] {
    return Array.from({ length }, (_, i) => Math.floor(value / 256 ** i) % 256);
  }
}
