/**
 * Client-side folder scan using FileSystemDirectoryHandle.
 * Builds candidates for the library-metadata API (no paths sent to server).
 */

type DirHandleWithEntries = FileSystemDirectoryHandle & {
  entries(): AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>;
};

const VIDEO_EXT = new Set(
  ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v'].map((e) => e.toLowerCase())
);

function isVideoFile(name: string): boolean {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
  return VIDEO_EXT.has(ext);
}

export interface MetadataCandidate {
  folderName?: string;
  videoName: string;
  relativePath: string;
  folderRelativePath: string;
  fileNamesInFolder: string[];
  source: 'folder' | 'root';
  index: number;
}

export async function scanFolderHandle(
  handle: FileSystemDirectoryHandle
): Promise<MetadataCandidate[]> {
  const candidates: MetadataCandidate[] = [];
  let index = 0;

  const entries: [string, FileSystemFileHandle | FileSystemDirectoryHandle][] = [];
  for await (const [name, entry] of (handle as DirHandleWithEntries).entries()) {
    entries.push([name, entry]);
  }

  const subdirs = entries.filter(([, e]) => e.kind === 'directory');
  const rootFiles = entries.filter(([, e]) => e.kind === 'file');

  for (const [dirName, dirHandle] of subdirs) {
    if (dirHandle.kind !== 'directory') continue;
    const subEntries: [string, FileSystemFileHandle | FileSystemDirectoryHandle][] = [];
    try {
      for await (const [name, entry] of (dirHandle as DirHandleWithEntries).entries()) {
        subEntries.push([name, entry]);
      }
    } catch {
      continue;
    }
    const subFiles = subEntries.filter(([, e]) => e.kind === 'file');
    const subVideoFiles = subFiles
      .filter(([name]) => isVideoFile(name))
      .map(([name, entry]) => ({ name, handle: entry as FileSystemFileHandle }));
    if (subVideoFiles.length === 0) continue;

    subVideoFiles.sort((a, b) => {
      const aExt = a.name.slice(a.name.lastIndexOf('.')).toLowerCase();
      const bExt = b.name.slice(b.name.lastIndexOf('.')).toLowerCase();
      if (aExt === '.mp4' && bExt !== '.mp4') return -1;
      if (aExt !== '.mp4' && bExt === '.mp4') return 1;
      return a.name.localeCompare(b.name);
    });
    const chosen = subVideoFiles[0]!;
    const fileNamesInFolder = subFiles.map(([n]) => n);
    const relativePath = `${dirName}/${chosen.name}`;
    candidates.push({
      folderName: dirName,
      videoName: chosen.name,
      relativePath,
      folderRelativePath: dirName,
      fileNamesInFolder,
      source: 'folder',
      index: index++,
    });
  }

  const rootVideoFiles = rootFiles.filter(([name]) => isVideoFile(name));
  const rootFileNames = rootFiles.map(([n]) => n);
  for (const [fileName] of rootVideoFiles) {
    candidates.push({
      videoName: fileName,
      relativePath: fileName,
      folderRelativePath: '',
      fileNamesInFolder: rootFileNames,
      source: 'root',
      index: index++,
    });
  }

  return candidates;
}
