## ADDED Requirements

### Requirement: Tauri v2 + React 19 + Vite project structure
The project SHALL be initialized as a Tauri v2 application with a React 19 frontend bundled by Vite. The Rust backend SHALL reside in `src-tauri/` and the React frontend in `src/`. The project SHALL use TypeScript for all frontend code.

#### Scenario: Fresh project initialization
- **WHEN** the project is initialized
- **THEN** the directory structure SHALL contain `src-tauri/` (Cargo.toml, src/main.rs, src/lib.rs, tauri.conf.json), `src/` (React components, App.tsx, main.tsx), `index.html`, `vite.config.ts`, and `package.json`

### Requirement: Bun as package manager
The project SHALL use Bun as the package manager. A `bun.lockb` lockfile SHALL be committed to the repository. All dependency installation and script execution SHALL use `bun` commands.

#### Scenario: Dependency installation
- **WHEN** a developer clones the repository and runs `bun install`
- **THEN** all dependencies SHALL be installed and the project SHALL be ready to develop

### Requirement: Biome configuration
The project SHALL include a `biome.json` configuration file with linting and formatting rules enabled. Biome SHALL replace ESLint and Prettier entirely.

#### Scenario: Lint and format check
- **WHEN** `bunx biome ci .` is executed
- **THEN** all source files SHALL pass linting and formatting checks with zero errors

### Requirement: Tailwind CSS v4 setup
The project SHALL use Tailwind CSS v4 with the default configuration. Tailwind SHALL coexist with MUI's styling without conflicts.

#### Scenario: Tailwind utility classes render correctly
- **WHEN** a component uses Tailwind utility classes (e.g., `className="flex gap-4 p-2"`)
- **THEN** the styles SHALL render correctly alongside MUI components

### Requirement: TypeScript strict mode
The project SHALL use TypeScript with strict mode enabled. The `tsconfig.json` SHALL include `"strict": true`.

#### Scenario: Type checking passes
- **WHEN** `bunx tsc --noEmit` is executed
- **THEN** all source files SHALL pass type checking with zero errors
