/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import fs, { writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { devNull } from "node:os";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ImageSizeReader } from "@noldova/teamrun.core";

import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class ImageSizeReaderTests {
  @TestMethod
  public readsPngGifAndWebPSizesFromTheirHeaders(): void {
    Assert.areEqual("640x480", ImageSizeReaderTests.read(ImageSizeReaderTests.png(640, 480)));
    Assert.areEqual("32x16", ImageSizeReaderTests.read(ImageSizeReaderTests.gif("GIF89a", 32, 16)));
    Assert.areEqual("7x9", ImageSizeReaderTests.read(ImageSizeReaderTests.gif("GIF87a", 7, 9)));
    Assert.areEqual("4000x3000", ImageSizeReaderTests.read(ImageSizeReaderTests.webp("VP8X",
      Buffer.concat([Buffer.alloc(4), ImageSizeReaderTests.uint24(3999), ImageSizeReaderTests.uint24(2999)]))));
    Assert.areEqual("300x200", ImageSizeReaderTests.read(ImageSizeReaderTests.webp("VP8L",
      Buffer.concat([Buffer.from([0x2f]), ImageSizeReaderTests.uint32((199 << 14) | 299), Buffer.alloc(5)]))));
    Assert.areEqual("800x600", ImageSizeReaderTests.read(ImageSizeReaderTests.webp("VP8 ",
      Buffer.concat([Buffer.alloc(3), Buffer.from([0x9d, 0x01, 0x2a]), ImageSizeReaderTests.uint16(800 | 0x4000), ImageSizeReaderTests.uint16(600)]))));
  }

  @TestMethod
  public namesAnImagesKindFromItsBytesWhateverItsName(): void {
    const images = [ImageSizeReaderTests.png(2, 3), ImageSizeReaderTests.gif("GIF89a", 2, 3),
      ImageSizeReaderTests.webp("VP8X", Buffer.concat([Buffer.alloc(4), ImageSizeReaderTests.uint24(1), ImageSizeReaderTests.uint24(2)])),
      ImageSizeReaderTests.jpeg(ImageSizeReaderTests.segment(0xc2, Buffer.from([8, 0x01, 0xe0, 0x02, 0x80, 3]))),
      ImageSizeReaderTests.png(0, 3), Buffer.alloc(0)];

    Assert.areEqual("image/png,image/gif,image/webp,image/jpeg,null,null", images.map(t => String(ImageSizeReader.mediaTypeOf(t))).join(","));
  }

  @TestMethod
  public namesAnSvgFromItsRootElementAfterItsPrologue(): void {
    const prologue = "\uFEFF<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!-- drawn - by hand -->\n"
      + "<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\" [ <!ENTITY a \"b\"> ]>\n";
    const svgs = ["<svg xmlns=\"http://www.w3.org/2000/svg\"/>", "<svg>", `${prologue}<svg\nviewBox="0 0 2 1">`, `<!---->${" ".repeat(64 * 1024)}<svg/>`,
      "<svgs/>", "<html><svg/></html>", "text <svg/>", "<!-- open <svg/>", "<!-- a -- b --><svg/>", "<?xml version=\"1.0\"><svg/>"];

    Assert.areEqual("image/svg+xml,image/svg+xml,image/svg+xml,null,null,null,null,null,null,null",
      svgs.map(t => String(ImageSizeReader.mediaTypeOf(Buffer.from(t, "utf8")))).join(","));
    Assert.isNull(ImageSizeReader.readBuffer(Buffer.from(svgs[0]!, "utf8")));
  }

  @TestMethod
  public readsAJpegsFrameAfterOtherSegmentsAndSwapsARotatedOne(): void {
    const frame = ImageSizeReaderTests.segment(0xc2, Buffer.from([8, 0x01, 0xe0, 0x02, 0x80, 3]));
    const app0 = ImageSizeReaderTests.segment(0xe0, Buffer.from("JFIF\0\x01\x02", "latin1"));
    const xmp = ImageSizeReaderTests.segment(0xe1, Buffer.from("http://ns.adobe.com/xap/1.0/\0", "latin1"));

    Assert.areEqual("640x480", ImageSizeReaderTests.read(ImageSizeReaderTests.jpeg(app0, Buffer.from([0xff]), xmp, frame)));
    for (const orientation of [5, 6, 7, 8]) {
      Assert.areEqual("480x640", ImageSizeReaderTests.read(ImageSizeReaderTests.jpeg(ImageSizeReaderTests.exif(false, orientation), frame)));
      Assert.areEqual("480x640", ImageSizeReaderTests.read(ImageSizeReaderTests.jpeg(ImageSizeReaderTests.exif(true, orientation), frame)));
    }
    for (const orientation of [1, 2, 3, 4])
      Assert.areEqual("640x480", ImageSizeReaderTests.read(ImageSizeReaderTests.jpeg(ImageSizeReaderTests.exif(true, orientation), frame)));
    Assert.areEqual("640x480", ImageSizeReaderTests.read(ImageSizeReaderTests.jpeg(ImageSizeReaderTests.exif(true, 6, 0x0110), frame)));
    Assert.areEqual("640x480", ImageSizeReaderTests.read(ImageSizeReaderTests.jpeg(ImageSizeReaderTests.exif(true, 6, 0x0112, 4096), frame)));
    Assert.areEqual("640x480", ImageSizeReaderTests.read(ImageSizeReaderTests.jpeg(ImageSizeReaderTests.segment(0xe1, Buffer.from("Exif\0\0II", "latin1")), frame)));
  }

  @TestMethod
  public readsNoSizeFromAHeaderItCantRead(): void {
    const frame = ImageSizeReaderTests.segment(0xc0, Buffer.from([8, 0x01, 0xe0, 0x02, 0x80, 3]));
    const unreadable = [
      Buffer.alloc(0),
      ImageSizeReaderTests.png(640, 480).subarray(0, 20),
      ImageSizeReaderTests.png(0, 480),
      ImageSizeReaderTests.gif("GIF89a", 32, 0),
      ImageSizeReaderTests.gif("GIF90a", 32, 16),
      ImageSizeReaderTests.webp("VP8Q", Buffer.alloc(10)),
      ImageSizeReaderTests.webp("VP8L", Buffer.concat([Buffer.from([0x2e]), Buffer.alloc(9)])),
      ImageSizeReaderTests.webp("VP8 ", Buffer.alloc(10)),
      Buffer.concat([Buffer.from("RIFF\0\0\0\0WEBM", "latin1"), Buffer.alloc(20)]),
      Buffer.from([0xff, 0xd8]),
      ImageSizeReaderTests.jpeg(ImageSizeReaderTests.segment(0xe0, Buffer.alloc(4))),
      ImageSizeReaderTests.jpeg(ImageSizeReaderTests.segment(0xda, Buffer.alloc(4)), frame),
      ImageSizeReaderTests.jpeg(Buffer.from([0xff, 0xd9]), frame),
      ImageSizeReaderTests.jpeg(Buffer.from([0x00, 0xc0, 0x00, 0x11]), frame),
      ImageSizeReaderTests.jpeg(frame.subarray(0, 7)),
      Buffer.from("not an image at all, just text", "latin1")
    ];

    for (const data of unreadable)
      Assert.isNull(ImageSizeReader.readBuffer(data));
  }

  @TestMethod
  public readsAFilesHeaderWithoutReadingThePixels(): void {
    using directory = new TemporaryDataDirectory();
    const path = join(directory.path, "photo.jpg");
    writeFileSync(path, ImageSizeReaderTests.jpeg(ImageSizeReaderTests.exif(false, 6), ImageSizeReaderTests.segment(0xc0,
      Buffer.from([8, 0x01, 0xe0, 0x02, 0x80, 3])), Buffer.alloc(64 * 1024)));
    const empty = join(directory.path, "empty.png");
    writeFileSync(empty, "");

    Assert.areEqual("480x640", `${ImageSizeReader.readFile(path)?.width}x${ImageSizeReader.readFile(path)?.height}`);
    Assert.isNull(ImageSizeReader.readFile(empty));
  }

  @TestMethod
  public readsAFilesHeaderInChunksAndANamedPipeWithoutWaiting(): void {
    using directory = new TemporaryDataDirectory();
    const far = join(directory.path, "far.jpg");
    writeFileSync(far, ImageSizeReaderTests.jpeg(ImageSizeReaderTests.segment(0xe2, Buffer.alloc(65533)), ImageSizeReaderTests.segment(0xe2, Buffer.alloc(65533)),
      ImageSizeReaderTests.segment(0xc0, Buffer.from([8, 0x01, 0xe0, 0x02, 0x80, 3]))));
    const filled = join(directory.path, "filled.jpg");
    writeFileSync(filled, Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(1024 * 1024, 0xff)]));
    let reads = 0;
    const original = fs.readSync;
    fs.readSync = new Proxy(original, { apply: (target, self, args: unknown[]): unknown => {
      reads++;
      return Reflect.apply(target, self, args);
    } });
    syncBuiltinESMExports();
    try {
      const size = ImageSizeReader.readFile(far);
      Assert.areEqual("640x480", `${size?.width}x${size?.height}`);
      reads = 0;
      Assert.isNull(ImageSizeReader.readFile(filled));
    }
    finally {
      fs.readSync = original;
      syncBuiltinESMExports();
    }

    Assert.isTrue(reads < 32, `${reads} reads`);
    Assert.isNull(ImageSizeReader.readFile(devNull));
    if (process.platform !== "win32") {
      const pipe = join(directory.path, "pipe.png");
      execFileSync("mkfifo", [pipe]);
      Assert.isNull(ImageSizeReader.readFile(pipe));
    }
  }

  private static read(data: Buffer): string {
    const size = ImageSizeReader.readBuffer(data);
    return `${size?.width}x${size?.height}`;
  }

  private static png(width: number, height: number): Buffer {
    return Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d", "hex"), Buffer.from("IHDR", "latin1"),
      ImageSizeReaderTests.uint32(width, false), ImageSizeReaderTests.uint32(height, false), Buffer.alloc(5)]);
  }

  private static gif(signature: string, width: number, height: number): Buffer {
    return Buffer.concat([Buffer.from(signature, "latin1"), ImageSizeReaderTests.uint16(width), ImageSizeReaderTests.uint16(height), Buffer.alloc(3)]);
  }

  private static webp(chunk: string, payload: Buffer): Buffer {
    return Buffer.concat([Buffer.from("RIFF", "latin1"), ImageSizeReaderTests.uint32(22 + payload.length), Buffer.from("WEBP" + chunk, "latin1"),
      ImageSizeReaderTests.uint32(payload.length), payload]);
  }

  private static jpeg(...segments: Buffer[]): Buffer {
    return Buffer.concat([Buffer.from([0xff, 0xd8]), ...segments]);
  }

  private static segment(marker: number, payload: Buffer): Buffer {
    const length = Buffer.alloc(2);
    length.writeUInt16BE(payload.length + 2);
    return Buffer.concat([Buffer.from([0xff, marker]), length, payload]);
  }

  private static exif(little: boolean, orientation: number, tag: number = 0x0112, directory: number = 8): Buffer {
    const tiff = Buffer.alloc(38);
    const write16 = (value: number, at: number): number => little ? tiff.writeUInt16LE(value, at) : tiff.writeUInt16BE(value, at);
    const write32 = (value: number, at: number): number => little ? tiff.writeUInt32LE(value, at) : tiff.writeUInt32BE(value, at);
    tiff.write(little ? "II" : "MM", 0, "latin1");
    write16(42, 2);
    write32(directory, 4);
    write16(2, 8);
    write16(0x010f, 10);
    write16(2, 12);
    write32(1, 14);
    write16(tag, 22);
    write16(3, 24);
    write32(1, 26);
    write16(orientation, 30);
    return ImageSizeReaderTests.segment(0xe1, Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]));
  }

  private static uint16(value: number): Buffer {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(value);
    return buffer;
  }

  private static uint24(value: number): Buffer {
    const buffer = Buffer.alloc(3);
    buffer.writeUIntLE(value, 0, 3);
    return buffer;
  }

  private static uint32(value: number, little: boolean = true): Buffer {
    const buffer = Buffer.alloc(4);
    if (little)
      buffer.writeUInt32LE(value >>> 0);
    else
      buffer.writeUInt32BE(value >>> 0);
    return buffer;
  }
}
