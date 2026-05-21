export interface AppRouterContext {
  courses: Course[];
  loading: boolean;
  error: string | null;
  onClearError: () => void;
  onImportComplete: (course: Course) => void;
  onDeleteCourse: (id: number) => void | Promise<void>;
}
