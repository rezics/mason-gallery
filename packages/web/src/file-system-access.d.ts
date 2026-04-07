interface Window {
  showDirectoryPicker(options?: {
    mode?: "read" | "readwrite";
  }): Promise<FileSystemDirectoryHandle>;
}

interface DataTransferItem {
  getAsFileSystemHandle(): Promise<FileSystemHandle | null>;
}
