export type StorageObject = {
  key: string;
  contentType: string;
  size: number;
};

export function createStorageKey(...segments: string[]) {
  return segments.join("/");
}
