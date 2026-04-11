## ADDED Requirements

### Requirement: Collapsible folder sidebar
The application SHALL provide a collapsible sidebar displaying the directory tree of the scanned folder. The sidebar SHALL use a MUI persistent Drawer anchored to the left side.

#### Scenario: Sidebar opens
- **WHEN** the user clicks the sidebar toggle button
- **THEN** a sidebar SHALL slide in from the left, pushing the masonry grid content to the right

#### Scenario: Sidebar closes
- **WHEN** the user clicks the sidebar toggle button while the sidebar is open
- **THEN** the sidebar SHALL collapse and the masonry grid SHALL expand to fill the available width

#### Scenario: Default state
- **WHEN** the application launches or a new folder is scanned
- **THEN** the sidebar SHALL be hidden by default

### Requirement: Folder tree display
The sidebar SHALL render the directory hierarchy as an expandable/collapsible tree using MUI TreeView.

#### Scenario: Tree structure
- **WHEN** the scanned directory contains `Photos/2024/January`, `Photos/2024/February`, `Photos/2023`
- **THEN** the sidebar tree SHALL display a root node with `2024` and `2023` as children, and `January`/`February` as children of `2024`

#### Scenario: Expand and collapse nodes
- **WHEN** the user clicks the expand arrow on a tree node
- **THEN** the node's children SHALL become visible
- **AND** clicking again SHALL collapse the children

#### Scenario: Image counts displayed
- **WHEN** the sidebar is visible and images have been loaded
- **THEN** each folder node SHALL display the number of images it contains (including descendants)

### Requirement: Folder selection filtering
Clicking a folder in the sidebar SHALL filter the masonry grid to show only images within that folder and its subfolders.

#### Scenario: Select a subfolder
- **WHEN** the user clicks on the `2024/January` folder in the sidebar
- **THEN** the masonry grid SHALL display only images whose `relativePath` starts with `2024/January/`

#### Scenario: Select root (show all)
- **WHEN** the user clicks the root folder node or a "Show All" control
- **THEN** the masonry grid SHALL display all images from all folders

#### Scenario: Folder selection persists during scan
- **WHEN** the user selects a folder while scanning is still in progress
- **THEN** newly arriving images matching the selected folder SHALL appear in the grid
- **AND** images not matching SHALL be filtered out

### Requirement: Responsive sidebar behavior
The sidebar SHALL adapt to available screen width.

#### Scenario: Small viewport
- **WHEN** the viewport width is below 768px
- **THEN** the sidebar SHALL use a temporary (overlay) variant instead of persistent, to avoid compressing the grid excessively

#### Scenario: Sidebar toggle accessible
- **WHEN** the sidebar is collapsed at any viewport size
- **THEN** a toggle button SHALL remain visible in the titlebar or stats bar area
