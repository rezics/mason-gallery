export interface WebGallerySource {
  id: string;
  name: string;
  path: string;
  blobUrl: string;
}

export interface WebFileRegistry {
  register(handle: FileSystemFileHandle, blobUrl: string): string;
  getBlobUrl(id: string): string;
  revoke(id: string): void;
  clear(): void;
}
