/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeDeviceFileStore } from "./fake-device-file-store.fixture.js";

export class FakeDeviceFiles {
  public readonly created: (readonly [string, string])[] = [];
  public readonly appearance: FakeDeviceFileStore = new FakeDeviceFileStore();
  public readonly state: FakeDeviceFileStore = new FakeDeviceFileStore();

  public create(folder: string, fileName: string): FakeDeviceFileStore {
    this.created.push([folder, fileName]);
    switch (fileName) {
      case "appearance.json":
        return this.appearance;
      case "device-state.json":
        return this.state;
      default:
        throw new Error(`No fake device file is named ${fileName}.`);
    }
  }
}
