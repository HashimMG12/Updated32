export interface MusicFileModuleSpec {
  startPlayback: (uri: string) => void;
  stopPlayback: () => void;
}

declare const MusicFileModule: MusicFileModuleSpec;
export default MusicFileModule;
