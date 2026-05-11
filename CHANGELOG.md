# Changelog
All notable changes to this project will be documented in this file.

## [2.1.129] - 2026-05-11
### Added
- Implemented Brief mode retry logic to automatically recover from plain-text model responses.
- Added Focus Mode system prompt for non-interactive sessions to ensure comprehensive final summaries.
- Created `/team-onboarding` command for streamlining teammate ramp-up.
- Implemented auto-creation of default cloud environments in `teleportToRemote`.

### Changed
- Improved API error reporting to surface detailed Anthropic refusal reasons.
- Enhanced tool-not-available error messages to clarify context-specific restrictions.
- Stabilized `tsconfig.json` to support rigorous type-checking and modern JSX.

### Fixed
- Resolved numerous TypeScript lint errors in core query loop and prompt generation logic.
- Fixed global type declarations for `MACRO` properties.

## [0.0.1] - 2026-05-11
### Added
- Initial release with core functionality