interface ElectronAPI {
  selectDirectory: () => Promise<string | null>;
  scanDirectory: (dirPath: string) => Promise<{ files: ScannedFile[]; basePath: string }>;
  checkFileExists: (filePath: string) => Promise<boolean>;
  getSettings: () => Promise<AppSettings | null>;
  saveSettings: (settings: AppSettings) => Promise<boolean>;
  getSrtFilePath: (videoFilePath: string) => string;
  readSrtFile: (srtFilePath: string) => Promise<string | null>;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
}

interface ScannedFile {
  name: string;
  path: string;
  size: number;
  mtime: Date;
}

interface Window {
  electronAPI: ElectronAPI;
}
