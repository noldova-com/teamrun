/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FileShare } from "../../../src/app/models/file-share";
import { KeptRead } from "../../../src/app/models/kept-read";
import { DeferredResponse } from "../../fixtures/deferred-response.fixture";

describe("KeptRead", () => {
  it("keeps a share until its time ends or its release, releases it once, and releases one it is given after its release at once", () => {
    const discard = vi.fn();
    const late = vi.fn();
    const read = new KeptRead("c1", Promise.resolve(null));
    const unanswered = new KeptRead("c1", Promise.resolve(null));

    expect(read.keep(new FileShare("desktop-file://a/", discard), 100)).toBe("desktop-file://a/");
    expect([read.hasExpired(99), read.hasExpired(100), unanswered.hasExpired(Number.MAX_SAFE_INTEGER)]).toEqual([false, true, false]);
    read.release();
    read.release();
    expect(read.hasExpired(0)).toBe(true);
    expect(read.keep(new FileShare("desktop-file://b/", late), 200)).toBe("desktop-file://b/");

    expect([discard.mock.calls.length, late.mock.calls.length]).toEqual([1, 1]);
  });

  it("holds its share while a load draws it, released or not, and releases it once the last load has drawn", async () => {
    const discard = vi.fn();
    const answer = new DeferredResponse();
    const read = new KeptRead("c1", answer.promise.then(t => t as string | null));
    const first = new DeferredResponse();
    const second = new DeferredResponse();
    const urls: (string | null)[] = [];
    const draw = (done: Promise<unknown>): ((url: string | null) => Promise<number>) => url => (urls.push(url), done.then(() => urls.length));

    const drawing = [read.drawAsync(draw(first.promise)), read.drawAsync(draw(second.promise))];
    read.release();
    answer.resolve(read.keep(new FileShare("desktop-file://a/", discard), 100));
    await read.url;
    await Promise.resolve();
    first.resolve(null);
    await drawing[0];
    const held = discard.mock.calls.length;
    second.resolve(null);

    expect(await Promise.all(drawing)).toEqual([2, 2]);
    expect([urls, held, discard.mock.calls.length]).toEqual([["desktop-file://a/", "desktop-file://a/"], 0, 1]);
  });

  it("keeps its share after a load draws it while it isn't released", async () => {
    const discard = vi.fn();
    const read = new KeptRead("c1", Promise.resolve("desktop-file://a/"));
    read.keep(new FileShare("desktop-file://a/", discard), 100);

    expect(await read.drawAsync(t => Promise.resolve(t))).toBe("desktop-file://a/");
    expect(discard).not.toHaveBeenCalled();
    read.release();
    expect(discard).toHaveBeenCalledTimes(1);
  });

  it("says it was a share once it is given one, even after its release, and not while it holds a read of bytes", () => {
    const shared = new KeptRead("c1", Promise.resolve(null));
    const released = new KeptRead("c1", Promise.resolve(null));
    released.release();

    shared.keep(new FileShare("desktop-file://a/", vi.fn()), 100);
    released.keep(new FileShare("desktop-file://b/", vi.fn()), 100);

    expect([shared.isShare, released.isShare, new KeptRead("c1", Promise.resolve("data:image/png;base64,AAAA")).isShare]).toEqual([true, true, false]);
  });
});
