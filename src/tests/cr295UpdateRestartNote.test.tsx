import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SelfUpdateNotification } from "../app/SelfUpdateNotification";
import { SelfUpdatePanel } from "../app/SelfUpdatePanel";
import { UPDATE_RESTART_NOTE, UpdateRestartNote } from "../app/UpdateRestartNote";
import type { SelfUpdateCheckResult } from "../app/selfUpdateStorage";
import notificationSource from "../app/SelfUpdateNotification.tsx?raw";
import panelSource from "../app/SelfUpdatePanel.tsx?raw";

const neverCheck = () => new Promise<never>(() => undefined);
const neverInstall = () => new Promise<void>(() => undefined);
const neverVersion = () => new Promise<string>(() => undefined);
const available: SelfUpdateCheckResult & { status: "available" } = {
  status: "available",
  version: "0.4.0-alpha.28",
  currentVersion: "0.4.0-alpha.27",
  update: {} as never,
};

// CR295: on Windows the updater exits the app as soon as the installer starts, and the installer takes
// seconds to show; the person is told in advance that the app comes back by itself.
describe("CR295 the update says the app will come back by itself", () => {
  it("states that the app closes, reopens alone and does not need to be opened again", () => {
    expect(UPDATE_RESTART_NOTE).toBe(
      "Nautilus will close and reopen by itself in a few minutes. There is no need to open the app again until this process finishes.",
    );
    expect(UPDATE_RESTART_NOTE).not.toMatch(/[—–]/);
  });

  it("renders the sentence as a status note", () => {
    const html = renderToStaticMarkup(<UpdateRestartNote />);
    expect(html).toContain(UPDATE_RESTART_NOTE);
    expect(html).toContain('role="status"');
  });

  it("is shown by the chip popover and by Settings › Updates only while an update installs", () => {
    for (const source of [notificationSource, panelSource]) {
      const branch = source.match(/state\.status === "installing" \? <>([\s\S]*?)<\/> : null/);
      expect(branch?.[1]).toContain("<UpdateRestartNote />");
      expect(source.match(/<UpdateRestartNote \/>/g)).toHaveLength(1);
    }
  });

  it("is absent from both surfaces while no update installs", () => {
    const chip = renderToStaticMarkup(
      <SelfUpdateNotification runtimeBusy={false} initialUpdate={available} initialOpen checkUpdates={neverCheck} getCurrentVersion={neverVersion} installUpdate={neverInstall} onReview={() => undefined} />,
    );
    const panel = renderToStaticMarkup(
      <SelfUpdatePanel runtimeBusy={false} reviewedUpdate={available} checkUpdates={neverCheck} installUpdate={neverInstall} />,
    );
    expect(chip).not.toContain(UPDATE_RESTART_NOTE);
    expect(panel).not.toContain(UPDATE_RESTART_NOTE);
  });
});
