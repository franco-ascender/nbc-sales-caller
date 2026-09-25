export interface AcademyLesson { id: string; title: string; videoUrl?: string }
export interface AcademyModule { id: string; title: string; lessons: AcademyLesson[] }
export interface AcademyCourse { id: string; title: string; modules: AcademyModule[]; description?: string; coverId?: string }
export interface AcademyManifest { version: 1 | 2; courses: AcademyCourse[] }
export interface AcademyInventory { courses: number; modules: number; lessons: number; videos: number }
