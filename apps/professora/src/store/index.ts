import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Annotation,
  AttendanceRecord,
  BoardNote,
  CalendarEvent,
  ClassData,
  CommunityPost,
  FeatureAccess,
  InterventionHistoryItem,
  OnboardingData,
  Subscreen,
  Tab,
  TeacherPersonalDocument,
  TimelineEvent,
} from '@/types'
import { getInitialAppData } from '@/services/app-data'
import { mergeBoardNotes } from '@/services/supabase/board-notes'

const initialAppData = getInitialAppData()

interface OnboardingStore {
  completed: boolean
  step: 1 | 2 | 3
  data: Partial<OnboardingData>
  setStep: (step: 1 | 2 | 3) => void
  setData: (data: Partial<OnboardingData>) => void
  setCompleted: (completed: boolean) => void
  complete: () => void
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set): OnboardingStore => ({
      completed: false,
      step: 1,
      data: {},
      setStep: (step) => set({ step }),
      setData: (data) => set((state) => ({ data: { ...state.data, ...data } })),
      setCompleted: (completed) => set({ completed }),
      complete: () => set({ completed: true }),
    }),
    { name: 'approf-onboarding' },
  ),
)

interface SubscreenFrame {
  screen: Subscreen
  data?: unknown
}

interface NavStore {
  activeTab: Tab
  subscreens: SubscreenFrame[]
  setTab: (tab: Tab) => void
  openSubscreen: (screen: Subscreen, data?: unknown) => void
  closeSubscreen: () => void
  closeAllSubscreens: () => void
  restoreSubscreens: (frames: SubscreenFrame[]) => void
}

export const useNavStore = create<NavStore>()((set) => ({
  activeTab: 'home',
  subscreens: [],
  setTab: (tab) => set({ activeTab: tab, subscreens: [] }),
  openSubscreen: (screen, data) =>
    set((state) => ({ subscreens: [...state.subscreens, { screen, data }] })),
  closeSubscreen: () =>
    set((state) => ({ subscreens: state.subscreens.slice(0, -1) })),
  closeAllSubscreens: () => set({ subscreens: [] }),
  restoreSubscreens: (frames) => set({ subscreens: frames }),
}))

interface AppStore {
  userName: string
  schoolName: string
  teacherCode: string
  userId: string
  annotations: Annotation[]
  annotationsHasMore: boolean
  attendanceRecords: AttendanceRecord[]
  classes: ClassData[]
  boardNotes: BoardNote[]
  calendarEvents: CalendarEvent[]
  communityAccess: FeatureAccess
  communityPosts: CommunityPost[]
  interventions: InterventionHistoryItem[]
  personalDocuments: TeacherPersonalDocument[]
  activeClassId: string | null
  activeStudentId: string | null
  isCommunityEnabled: () => boolean
  hydrateWorkspace: (data: {
    userId: string
    userName: string
    schoolName: string
    classes: ClassData[]
    annotations?: Annotation[]
    annotationsHasMore?: boolean
    attendanceRecords?: AttendanceRecord[]
    boardNotes?: BoardNote[]
    communityAccess?: FeatureAccess
    communityPosts?: CommunityPost[]
    interventions?: InterventionHistoryItem[]
    teacherCode?: string
  }) => void
  setAnnotationsHasMore: (hasMore: boolean) => void
  setAnnotations: (annotations: Annotation[]) => void
  setUserName: (name: string) => void
  setSchoolName: (name: string) => void
  addAnnotation: (ann: Annotation) => void
  updateAnnotation: (ann: Annotation) => void
  removeAnnotation: (id: string) => void
  saveAttendanceRecord: (record: Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>) => void
  upsertAttendanceRecord: (record: AttendanceRecord) => void
  addBoardNote: (note: BoardNote) => void
  deleteBoardNote: (id: string) => void
  setCalendarEvents: (events: CalendarEvent[]) => void
  addCalendarEvent: (event: CalendarEvent) => void
  addCommunityPost: (post: CommunityPost) => void
  updateCommunityPost: (post: CommunityPost) => void
  removeCommunityPost: (id: string) => void
  addIntervention: (item: InterventionHistoryItem) => void
  updateIntervention: (item: InterventionHistoryItem) => void
  removeIntervention: (id: string) => void
  addPersonalDocument: (doc: TeacherPersonalDocument) => void
  removePersonalDocument: (id: string) => void
  addClass: (classData: ClassData) => void
  updateClass: (classId: string, updates: Partial<Omit<ClassData, 'id' | 'students'>>) => void
  addStudent: (classId: string, student: ClassData['students'][number]) => void
  removeStudent: (classId: string, studentId: string) => void
  updateStudent: (classId: string, studentId: string, updates: Partial<ClassData['students'][number]>) => void
  addTimelineEvent: (classId: string, studentId: string, event: TimelineEvent) => void
  removeTimelineEvent: (classId: string, studentId: string, eventId: string) => void
  setActiveClass: (id: string) => void
  setActiveStudent: (id: string) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get): AppStore => ({
      userId: 'demo-teacher-ana',
      userName: initialAppData.userName,
      schoolName: initialAppData.schoolName,
      teacherCode: 'PROF-ANA-2026',
      annotations: initialAppData.annotations,
      annotationsHasMore: false,
      attendanceRecords: [],
      classes: initialAppData.classes,
      boardNotes: initialAppData.boardNotes,
      calendarEvents: [],
      communityAccess: {
        global: false,
        allowedUserIds: ['demo-teacher-ana'],
      },
      personalDocuments: [],
      communityPosts: [
        {
          id: 'cp-1',
          authorId: 'demo-teacher-marina',
          authorName: 'Marina Costa',
          authorRole: 'Professora Jardim I',
          text: 'Como voces registram adaptações para alunos com muita dificuldade nas transicoes?',
          category: 'duvida' as const,
          likes: 18,
          comments: 7,
          likedByMe: false,
          createdAt: 'Hoje, 08h40',
        },
        {
          id: 'cp-2',
          authorId: 'demo-teacher-ana',
          authorName: 'Ana Lima',
          authorRole: 'Professora Pre I',
          text: 'Compartilhei com minha coordenacao um modelo de observacao semanal e funcionou muito bem.',
          category: 'relato' as const,
          likes: 31,
          comments: 5,
          likedByMe: true,
          createdAt: 'Ontem, 17h12',
        },
      ],
      interventions: [],
      activeClassId: null as string | null,
      activeStudentId: null as string | null,
      isCommunityEnabled: (): boolean => {
        const state = get()
        return state.communityAccess.global || state.communityAccess.allowedUserIds.includes(state.userId)
      },
      hydrateWorkspace: (data) =>
        set((state) => ({
          userId: data.userId,
          userName: data.userName,
          schoolName: data.schoolName,
          classes: data.classes,
          annotations: data.annotations ?? [],
          annotationsHasMore: data.annotationsHasMore ?? false,
          attendanceRecords: data.attendanceRecords ?? [],
          boardNotes: mergeBoardNotes(state.boardNotes, data.boardNotes ?? []),
          activeClassId: data.classes[0]?.id ?? null,
          activeStudentId: null,
          teacherCode: data.teacherCode ?? '',
          communityAccess: data.communityAccess ?? { global: false, allowedUserIds: [data.userId] },
          communityPosts: data.communityPosts ?? [],
          interventions: data.interventions ?? [],
          calendarEvents: [],
          personalDocuments: [],
        })),
      setAnnotationsHasMore: (hasMore) => set({ annotationsHasMore: hasMore }),
      setAnnotations: (annotations) => set({ annotations }),
      setUserName: (name: string) => set({ userName: name }),
      setSchoolName: (name: string) => set({ schoolName: name }),
      addAnnotation: (ann: Annotation) =>
        set((state) => ({ annotations: [ann, ...state.annotations] })),
      updateAnnotation: (ann: Annotation) =>
        set((state) => ({
          annotations: state.annotations.map((item) => (item.id === ann.id ? ann : item)),
        })),
      removeAnnotation: (id: string) =>
        set((state) => ({
          annotations: state.annotations.filter((item) => item.id !== id),
        })),
      saveAttendanceRecord: (record) =>
        set((state) => {
          const existing = state.attendanceRecords.find(
            (item) => item.classId === record.classId && item.date === record.date,
          )
          const now = new Date().toISOString()
          const nextRecord: AttendanceRecord = {
            ...record,
            id: existing?.id ?? `att-${record.classId}-${record.date}`,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          }

          return {
            attendanceRecords: existing
              ? state.attendanceRecords.map((item) => (item.id === existing.id ? nextRecord : item))
              : [nextRecord, ...state.attendanceRecords],
          }
        }),
      upsertAttendanceRecord: (record) =>
        set((state) => {
          const exists = state.attendanceRecords.some((item) => item.id === record.id)
          return {
            attendanceRecords: exists
              ? state.attendanceRecords.map((item) => (item.id === record.id ? record : item))
              : [
                  record,
                  ...state.attendanceRecords.filter(
                    (item) => !(item.classId === record.classId && item.date === record.date),
                  ),
                ],
          }
        }),
      addBoardNote: (note: BoardNote) =>
        set((state) => ({ boardNotes: [...state.boardNotes, note] })),
      deleteBoardNote: (id: string) =>
        set((state) => ({ boardNotes: state.boardNotes.filter((note) => note.id !== id) })),
      setCalendarEvents: (events: CalendarEvent[]) => set({ calendarEvents: events }),
      addCalendarEvent: (event: CalendarEvent) =>
        set((state) => ({ calendarEvents: [event, ...state.calendarEvents] })),
      addCommunityPost: (post: CommunityPost) =>
        set((state) => ({ communityPosts: [post, ...state.communityPosts] })),
      updateCommunityPost: (post: CommunityPost) =>
        set((state) => ({
          communityPosts: state.communityPosts.map((current) => (current.id === post.id ? post : current)),
        })),
      removeCommunityPost: (id: string) =>
        set((state) => ({
          communityPosts: state.communityPosts.filter((post) => post.id !== id),
        })),
      addIntervention: (item) =>
        set((state) => ({ interventions: [item, ...state.interventions] })),
      updateIntervention: (item) =>
        set((state) => ({
          interventions: state.interventions.map((current) => (current.id === item.id ? item : current)),
        })),
      removeIntervention: (id) =>
        set((state) => ({
          interventions: state.interventions.filter((item) => item.id !== id),
        })),
      addPersonalDocument: (doc: TeacherPersonalDocument) =>
        set((state) => ({ personalDocuments: [doc, ...state.personalDocuments] })),
      removePersonalDocument: (id: string) =>
        set((state) => ({
          personalDocuments: state.personalDocuments.filter((item) => item.id !== id),
        })),
      addClass: (classData: ClassData) =>
        set((state) => ({ classes: [classData, ...state.classes] })),
      updateClass: (classId, updates) =>
        set((state) => ({
          classes: state.classes.map((classData) =>
            classData.id === classId ? { ...classData, ...updates } : classData,
          ),
        })),
      addStudent: (classId: string, student: ClassData['students'][number]) =>
        set((state) => ({
          classes: state.classes.map((classData) =>
            classData.id === classId
              ? { ...classData, students: [student, ...classData.students] }
              : classData,
          ),
        })),
      removeStudent: (classId, studentId) =>
        set((state) => ({
          classes: state.classes.map((classData) =>
            classData.id === classId
              ? { ...classData, students: classData.students.filter((s) => s.id !== studentId) }
              : classData,
          ),
        })),
      updateStudent: (classId, studentId, updates) =>
        set((state) => ({
          classes: state.classes.map((classData) =>
            classData.id === classId
              ? {
                  ...classData,
                  students: classData.students.map((student) =>
                    student.id === studentId ? { ...student, ...updates } : student,
                  ),
                }
              : classData,
          ),
        })),
      addTimelineEvent: (classId, studentId, event) =>
        set((state) => ({
          classes: state.classes.map((classData) =>
            classData.id === classId
              ? {
                  ...classData,
                  students: classData.students.map((student) =>
                    student.id === studentId
                      ? {
                          ...student,
                          timeline: [event, ...(student.timeline ?? [])],
                        }
                      : student,
                  ),
                }
              : classData,
          ),
        })),
      removeTimelineEvent: (classId, studentId, eventId) =>
        set((state) => ({
          classes: state.classes.map((classData) =>
            classData.id === classId
              ? {
                  ...classData,
                  students: classData.students.map((student) =>
                    student.id === studentId
                      ? { ...student, timeline: (student.timeline ?? []).filter((e) => e.id !== eventId) }
                      : student,
                  ),
                }
              : classData,
          ),
        })),
      setActiveClass: (id: string) => set({ activeClassId: id }),
      setActiveStudent: (id: string) => set({ activeStudentId: id }),
    }),
    { name: 'approf-app' },
  ),
)
