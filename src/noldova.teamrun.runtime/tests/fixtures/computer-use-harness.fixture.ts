/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  AppIdentity,
  AppInfo,
  DesktopRect,
  type IAppBackend,
  type IBorderBackend,
  type ICaptureBackend,
  type IControlBackend,
  type IDisplayBackend,
  type IInputBackend,
  type IOperatingSystemBackend,
  type IPhysicalInputMonitor,
  type IWindowBackend,
  RuntimePart,
  WindowInfo
} from "@noldova/computer-use.runtime";
import {
  DataDirectory,
  type IModuleSettings,
  OwnershipLock,
  RememberedPermissionStore,
  ShellDatabase,
  ShellMigrations
} from "@noldova/desktop.runtime";
import { PermissionAnswerer, Resources } from "@noldova/teamrun.runtime";

import { AnsweringAsker } from "./answering-asker.fixture.js";
import { MemoryModuleDatabase } from "./memory-module-database.fixture.js";
import { RecordingOutput } from "./recording-output.fixture.js";
import { RecordingPartContext } from "./recording-part-context.fixture.js";
import { TemporaryDirectory } from "./temporary-directory.fixture.js";

export class ComputerUseHarness {
  public static readonly MODULE: string = "computer-use";
  public static readonly SCOPE: string = "c1/default";
  public static readonly REASON: string = "To write the note.";
  public static readonly LISTED_TOOL: string = "computer_list_apps";
  public static readonly SCREEN_ACTION: string = "computer-use.controlScreen";
  public static readonly APP_ACTION: string = "computer-use.controlApp";
  public static readonly APPS_SERVICE: string = "computer-use.apps";
  public static readonly NOTES: AppInfo = new AppInfo(new AppIdentity("C:\\Program Files\\Notes\\notes.exe"), "Notes", "Example Ltd", true, false);

  public static async runAsync<T>(part: RuntimePart, asker: AnsweringAsker, act: (context: RecordingPartContext) => Promise<T>): Promise<T> {
    using folder = new TemporaryDirectory();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    using database = await ShellDatabase.openAsync(lock, ShellMigrations.all, new Date(), new RecordingOutput());
    using moduleDatabase = new MemoryModuleDatabase();
    const context = new RecordingPartContext(folder.path, moduleDatabase, folder.path, new Map(), "teamrun", ComputerUseHarness.MODULE,
      Resources.computerUseTools);
    context.settings = ComputerUseHarness.settingsOf();
    context.tools.center.open(new RememberedPermissionStore(database));
    context.tools.center.registerAnswerer("teamrun", new PermissionAnswerer(asker), context.log);
    try {
      return await act(context);
    }
    finally {
      await part.deactivateAsync();
    }
  }

  public static settingsOf(): IModuleSettings {
    return {
      read: name => {
        if (name === "computer-use.showBorder")
          return false;
        if (name !== "computer-use.enabled")
          throw new Error(`The spec has no setting ${name}.`);
        return true;
      },
      onChanged: () => undefined,
      write: ComputerUseHarness.unusedSetting,
      reset: ComputerUseHarness.unusedSetting,
      setScopeParent: ComputerUseHarness.unusedSetting,
      removeScope: ComputerUseHarness.unusedSetting
    };
  }

  public static unusedSetting(): never {
    throw new Error("The part only reads its settings and follows their changes.");
  }

  public static notesWindow(): WindowInfo {
    return new WindowInfo(ComputerUseHarness.NOTES.identity, ComputerUseHarness.NOTES.name, "1", 1, new DesktopRect(0, 0, 800, 600), false);
  }

  public static backend(foreground: WindowInfo | null = null): IOperatingSystemBackend {
    const apps: IAppBackend = { listAppsAsync: () => Promise.resolve([ComputerUseHarness.NOTES]), describeAppAsync: () => Promise.resolve(null) };
    const physicalInput: IPhysicalInputMonitor = {
      heartbeatIntervalMs: 60_000,
      startAsync: () => Promise.resolve(),
      stopAsync: () => Promise.resolve(),
      onPhysicalInput: () => ({ [Symbol.dispose]: () => undefined }),
      onHeartbeat: () => ({ [Symbol.dispose]: () => undefined })
    };
    const unused = new UnusedBackend(foreground);
    return { apps, physicalInput, displays: unused, windows: unused, capture: unused, controls: unused, input: unused, border: unused };
  }
}

class UnusedBackend implements IDisplayBackend, IWindowBackend, ICaptureBackend, IControlBackend, IInputBackend, IBorderBackend {
  public readonly maxTextChunkLength: number = 100;
  private readonly foreground: WindowInfo | null;

  public constructor(foreground: WindowInfo | null) {
    this.foreground = foreground;
  }

  public listDisplaysAsync(): Promise<never> {
    return UnusedBackend.unused();
  }

  public getForegroundWindowAsync(): Promise<WindowInfo> {
    return this.foreground === null ? UnusedBackend.unused() : Promise.resolve(this.foreground);
  }

  public listStackAsync(): Promise<never> {
    return UnusedBackend.unused();
  }

  public measureDisplayAsync(): Promise<never> {
    return UnusedBackend.unused();
  }

  public captureWindowAsync(): Promise<never> {
    return UnusedBackend.unused();
  }

  public readControlsAsync(): Promise<never> {
    return UnusedBackend.unused();
  }

  public findControlAsync(): Promise<never> {
    return UnusedBackend.unused();
  }

  public isControlAtAsync(): Promise<never> {
    return UnusedBackend.unused();
  }

  public readPointerAsync(): Promise<never> {
    return UnusedBackend.unused();
  }

  public glidePointerAsync(): Promise<never> {
    return UnusedBackend.unused();
  }

  public movePointerAsync(): Promise<never> {
    return UnusedBackend.unused();
  }

  public clickAsync(): Promise<never> {
    return UnusedBackend.unused();
  }

  public dragAsync(): Promise<never> {
    return UnusedBackend.unused();
  }

  public scrollAsync(): Promise<never> {
    return UnusedBackend.unused();
  }

  public typeTextAsync(): Promise<never> {
    return UnusedBackend.unused();
  }

  public pressKeyAsync(): Promise<never> {
    return UnusedBackend.unused();
  }

  public isSystemCombination(): boolean {
    throw new Error("A request reaches no input.");
  }

  public unitsPerPixel(): number {
    throw new Error("A request reaches no border.");
  }

  public showAsync(): Promise<never> {
    return UnusedBackend.unused();
  }

  public hideAsync(): Promise<never> {
    return UnusedBackend.unused();
  }

  private static unused(): Promise<never> {
    return Promise.reject(new Error("A request reaches only the backend's apps and its watch of the person's input."));
  }
}
