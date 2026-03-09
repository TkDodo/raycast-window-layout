export function formatYabaiRequirementHint() {
  return [
    "Requires yabai to be installed and running.",
    "If Raycast cannot find it, set YABAI_PATH to your binary, for example /opt/homebrew/bin/yabai, then restart Raycast.",
  ].join(" ");
}
