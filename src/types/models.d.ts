interface Course {
  id?: number;
  title: string;
  path: string;
  dateAdded?: Date;
  sections?: Section[];
}

interface Section {
  id?: number;
  courseId?: number;
  title: string;
  index?: number;
  lectures?: Lecture[];
}

interface Lecture {
  id?: number;
  sectionId?: number;
  courseId?: number;
  title: string;
  filePath: string;
  subtitlePath: string | null;
  duration: number;
  index?: number;
  videoUrl?: string;
  savedProgress?: number;
  completed?: boolean;
  sectionTitle?: string;
}

interface LectureProgress {
  lectureId: number;
  position: number;
  watched: number;
  lastWatched: Date | null;
}

interface CourseProgress {
  totalLectures: number;
  watchedLectures: number;
  partialLectures: number;
  completionPercentage: number;
}

interface CourseDurations {
  totalDuration: number;
  sectionDurations: Record<number, number>;
}

interface PlaybackSettings {
  defaultSpeed: number;
  autoPlay: boolean;
  preferredQuality: string;
  rememberPosition: boolean;
  autoMarkCompleted: boolean;
  autoPlayNext: boolean;
  showCompletionOverlay: boolean;
}

interface ShortcutSettings {
  playPause: string;
  seekForward: string;
  seekBackward: string;
  volumeUp: string;
  volumeDown: string;
  toggleFullscreen: string;
}

interface AppSettings {
  playback: PlaybackSettings;
  shortcuts: ShortcutSettings;
  subtitles?: SubtitleSettings;
}

interface SubtitleSettings {
  enabled: boolean;
  fontSize: string;
  fontColor: string;
  backgroundColor: string;
}

interface PlayerSettings {
  defaultSpeed: number;
  autoPlay: boolean;
  rememberPosition: boolean;
  autoMarkCompleted: boolean;
  autoPlayNext: boolean;
  showCompletionOverlay: boolean;
}
