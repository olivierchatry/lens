/**
 * Copyright (c) 2021 OpenLens Authors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import { createHash } from "crypto";
import * as os from "os";
import * as path from "path";
import { Frame, Page, _electron as electron } from "playwright";
import tempy from "tempy";

export const AppPaths: Partial<Record<NodeJS.Platform, string>> = {
  "win32": "./dist/win-unpacked/OpenLens.exe",
  "linux": "./dist/linux-unpacked/open-lens",
  "darwin": "./dist/mac/OpenLens.app/Contents/MacOS/OpenLens",
};

export function itIf(condition: boolean) {
  return condition ? it : it.skip;
}

export function describeIf(condition: boolean) {
  return condition ? describe : describe.skip;
}

async function launchElectron() {
  let error;

  for (let i = 0; i < 10; i += 1) {
    try {
      return await electron.launch({
        args: ["--integration-testing"], // this argument turns off the blocking of quit
        executablePath: AppPaths[process.platform],
        bypassCSP: true,
        env: {
          CICD: tempy.directory(),
        }
      });
    } catch (e) {
      error = e;
    }
  }

  throw error ?? new Error("Failed to start electron after several attempts");
}

export async function start() {
  const app = await launchElectron();

  try {
    const window = await app.waitForEvent("window", {
      predicate: async (page) => page.url().startsWith("http://localhost"),
    });

    return {
      app,
      window,
      cleanup: async () => {
        await window.close().catch(err => void err);
        await app.close().catch(err => void err);
      },
    };
  } catch (error) {
    await app.close().catch(err => void err);

    throw error;
  }
}

export async function clickWelcomeButton(window: Page) {
  await window.click("#hotbarIcon-catalog-entity .Icon");
}

function minikubeEntityId() {
  return createHash("md5").update(`${path.join(os.homedir(), ".kube", "config")}:minikube`).digest("hex");
}

/**
 * From the catalog, click the minikube entity and wait for it to connect, returning its frame
 */
export async function lauchMinikubeClusterFromCatalog(window: Page): Promise<Frame> {
  await window.waitForSelector("div.TableCell");
  await window.click("div.TableCell >> text='minikube'");
  await window.waitForSelector("div.drawer-title-text >> text='KubernetesCluster: minikube'");
  await window.click("div.EntityIcon div.HotbarIcon div div.MuiAvatar-root");

  const minikubeFrame = await window.waitForSelector(`#cluster-frame-${minikubeEntityId()}`);

  const frame = await minikubeFrame.contentFrame();

  await frame.waitForSelector("div.Sidebar");

  return frame;
}
