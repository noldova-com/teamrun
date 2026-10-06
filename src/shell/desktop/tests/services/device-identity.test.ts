/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DeviceIdentity, DeviceIdentityException } from "@noldova/teamrun-shell-desktop";

@TestClass
export class DeviceIdentityTests {
  @TestMethod
  public async createsAnIdentityOnceAndKeepsIt(): Promise<void> {
    const folder = await mkdtemp(path.join(os.tmpdir(), "teamrun-device-"));
    try {
      const device = path.join(folder, "nested");

      const first = await DeviceIdentity.readOrCreateAsync(device);
      const second = await DeviceIdentity.readOrCreateAsync(device);

      Assert.isTrue(/^[0-9a-f-]{36}$/.test(first));
      Assert.areEqual(first, second);
      Assert.areEqual(JSON.stringify({ id: first }), (await readFile(path.join(device, "device.json"), "utf8")).trim());
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async givesDesktopsThatStartTogetherOneIdentityAndLeavesNoDraft(): Promise<void> {
    const folder = await mkdtemp(path.join(os.tmpdir(), "teamrun-device-"));
    try {
      const ids = await Promise.all(Array.from({ length: 8 }, () => DeviceIdentity.readOrCreateAsync(folder)));

      Assert.areEqual(1, new Set(ids).size);
      Assert.areEqual("device.json", (await readdir(folder)).join(","));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async refusesAnIdentityFileItCannotUse(): Promise<void> {
    const folder = await mkdtemp(path.join(os.tmpdir(), "teamrun-device-"));
    try {
      for (const text of ["{", "{\"id\":1}", "{\"id\":\"not-a-uuid\"}"]) {
        await writeFile(path.join(folder, "device.json"), text);
        const failure = await Assert.throwsAsync(() => DeviceIdentity.readOrCreateAsync(folder), DeviceIdentityException);
        Assert.isTrue(failure.message.endsWith("is not valid; remove the file to give this device a new identity."));
      }
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async refusesAnIdentityPathItCannotRead(): Promise<void> {
    const folder = await mkdtemp(path.join(os.tmpdir(), "teamrun-device-"));
    try {
      await mkdir(path.join(folder, "device.json"));

      await Assert.throwsAsync(() => DeviceIdentity.readOrCreateAsync(folder), DeviceIdentityException);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
