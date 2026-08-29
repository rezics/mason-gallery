interface Window {
  showDirectoryPicker(options?: {
    mode?: "read" | "readwrite";
  }): Promise<FileSystemDirectoryHandle>;
}

interface DataTransferItem {
  getAsFileSystemHandle(): Promise<FileSystemHandle | null>;
}

interface FileSystemHandle {
  queryPermission(options?: {
    mode?: "read" | "readwrite";
  }): Promise<PermissionState>;
  requestPermission(options?: {
    mode?: "read" | "readwrite";
  }): Promise<PermissionState>;
}
