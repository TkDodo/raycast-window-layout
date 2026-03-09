# Window Layout Restore

Raycast extension for saving and restoring named macOS window layouts using `yabai`.

## Requirements

- Raycast
- `yabai` installed and running
- Accessibility permissions for Raycast and `yabai`
- macOS configured so `yabai` can create and move Spaces

## Commands

- `Save Layout`: snapshot the current display, Space, and window arrangement into a named layout
- `Restore Layout`: apply a saved layout to the current open windows
- `Manage Layouts`: rename, delete, export, and import layouts

## Development

```bash
pnpm install
pnpm test
pnpm build
```
