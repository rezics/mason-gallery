## ADDED Requirements

### Requirement: Type-safe internationalization
The application SHALL use typesafe-i18n for internationalization. All user-facing strings SHALL be defined in locale files with TypeScript type safety.

#### Scenario: Missing translation key causes compile error
- **WHEN** a component references a translation key that does not exist
- **THEN** TypeScript compilation SHALL fail with a type error

### Requirement: English and Chinese locales
The application SHALL support English (`en`) as the default locale and Simplified Chinese (`zh`) as an additional locale.

#### Scenario: Default locale
- **WHEN** the application launches for the first time
- **THEN** the UI SHALL display in English

#### Scenario: Chinese locale
- **WHEN** the user switches to Chinese in settings
- **THEN** all UI text SHALL display in Simplified Chinese

### Requirement: Locale persistence
The selected locale SHALL be persisted in settings and restored on application launch.

#### Scenario: Locale survives restart
- **WHEN** the user selects Chinese and restarts the application
- **THEN** the application SHALL launch in Chinese
