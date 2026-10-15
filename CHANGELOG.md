# Changelog

## 0.1.2

- Keep each host sidebar controller alive until plugin teardown instead of disposing it when navigation swaps the sidebar entry component.
- Update theme colors in place; preserve manually expanded groups through entry remounts and sidebar DOM replacement.
- Use installation-bound navigation for retained sidebar controls.
- 24 regression tests and TypeScript checks pass. Native desktop click-through verification was unavailable for this release.

## 0.1.1

Resolve SDK types through the host-provided plugin context, so fresh Git installs compile without development dependencies. The 21 regression tests and TypeScript check pass.

## 0.1.0

Initial source release. Fresh Git installation failed because a type-only import referenced a development dependency; use 0.1.1 or newer.
