/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcessByStdio, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";

export class PrivateSessionBus {
  private static readonly DAEMON: string = "/usr/bin/dbus-daemon";

  private readonly folder: string;
  private readonly daemon: ChildProcessByStdio<null, Readable, null>;

  public readonly address: string;

  private constructor(folder: string, daemon: ChildProcessByStdio<null, Readable, null>, address: string) {
    this.folder = folder;
    this.daemon = daemon;
    this.address = address;
  }

  public static async startAsync(): Promise<PrivateSessionBus> {
    const folder = await mkdtemp(path.join(tmpdir(), "teamrun-bus-"));
    const configuration = path.join(folder, "bus.conf");
    await writeFile(configuration, [
      "<!DOCTYPE busconfig PUBLIC \"-//freedesktop//DTD D-Bus Bus Configuration 1.0//EN\" \"http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd\">",
      "<busconfig>",
      "<type>session</type>",
      `<listen>unix:path=${path.join(folder, "bus")}</listen>`,
      "<auth>EXTERNAL</auth>",
      "<policy context=\"default\"><allow send_destination=\"*\" eavesdrop=\"true\"/><allow eavesdrop=\"true\"/><allow own=\"*\"/></policy>",
      "</busconfig>"
    ].join("\n"));
    const daemon = spawn(PrivateSessionBus.DAEMON, [`--config-file=${configuration}`, "--nofork", "--print-address=1"], { stdio: ["ignore", "pipe", "ignore"] });
    daemon.stdout.setEncoding("utf8");
    const address = await new Promise<string>((resolve, reject) => {
      let printed = "";
      daemon.stdout.on("data", (t: string) => {
        printed += t;
        if (printed.includes("\n"))
          resolve(printed.trim());
      });
      daemon.once("error", reject);
      daemon.once("exit", () => reject(new Error(`${PrivateSessionBus.DAEMON} ended before it printed its address.`)));
    });
    return new PrivateSessionBus(folder, daemon, address);
  }

  public environment(): NodeJS.ProcessEnv {
    return { ...process.env, DBUS_SESSION_BUS_ADDRESS: this.address };
  }

  public async stopAsync(): Promise<void> {
    const exited = once(this.daemon, "exit");
    this.daemon.kill();
    await exited;
    await rm(this.folder, { recursive: true, force: true });
  }
}
