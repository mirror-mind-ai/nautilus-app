// CR295: the updater exits the app as soon as the installer starts and the installer takes seconds to show,
// so the person is told before it happens that the app comes back by itself.
export const UPDATE_RESTART_NOTE =
  "Nautilus will close and reopen by itself in a few minutes. There is no need to open the app again until this process finishes.";

export function UpdateRestartNote() {
  return <p className="provider-note" role="status">{UPDATE_RESTART_NOTE}</p>;
}
