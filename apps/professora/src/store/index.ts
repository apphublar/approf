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
  OnboardingData,
  Subscreen,
  Tab,
  TimelineEvent,
} from '@/types'
import { getInitialAppData } from '@/services/app-data'

const initialAppData = getInitialAppData()

interface OnboardingStore {
  completed: boolean
  step: 1 | 2 | 3
  data: Partial<OnboardingData>
  setStep: (step: 1 | 2 | 3) => void
  setData: (data: Partial<OnboardingData>) => void
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
}))

interface AppStore {
  userName: string
  schoolName: string
  teacherCode: string
  userId: string
  annotations: Annotation[]
  attendanceRecords: AttendanceRecord[]
  classes: ClassData[]
  boardNotes: BoardNote[]
  calendarEvents: CalendarEvent[]
  communityAccess: FeatureAccess
  communityPosts: CommunityPost[]
  activeClassId: string | null
  activeStudentId: string | null
  isCommunityEnabled: () => boolean
  hydrateWorkspace: (data: {
    userId: string
    userName: string
    schoolName: string
    classes: ClassData[]
    annotations?: Annotation[]
    attendanceRecords?: AttendanceRecord[]
  }) => void
  setUserName: (name: string) => void
  setSchoolName: (name: string) => void
  addAnnotation: (ann: Annotation) => void
  saveAttendanceRecord: (record: Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>) => void
  upsertAttendanceRecord: (record: AttendanceRecord) => void
  addBoardNote: (note: BoardNote) => void
  deleteBoardNote: (id: string) => void
  setCalendarEvents: (events: CalendarEvent[]) => void
  addCalendarEvent: (event: CalendarEvent) => void
  addCommunityPost: (post: CommunityPost) => void
  addClass: (classData: ClassData) => void
  updateClass: (classId: string, updates: Partial<Omit<ClassData, 'id' | 'students'>>) => void
  addStudent: (classId: string, student: ClassData['students'][number]) => void
  updateStudent: (classId: string, studentId: string, updates: Partial<ClassData['students'][number]>) => void
  addTimelineEvent: (classId: string, studentId: string, event: TimelineEvent) => void
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
      attendanceRecords: [],
      classes: initialAppData.classes,
      boardNotes: initialAppData.boardNotes,
      calendarEvents: [],
      communityAccess: {
        global: false,
        allowedUserIds: ['demo-teacher-ana'],
      },
      communityPosts: [
        {
          id: 'cp-1',
          authorName: 'Marina Costa',
          authorRole: 'Professora Jardim I',
          text: 'Como voces registram adaptacoes para alunos com muita dificuldade nas transicoes?',
          category: 'duvida' as const,
          likes: 18,
          comments: 7,
          createdAt: 'Hoje, 08h40',
        },
        {
          id: 'cp-2',
          authorName: 'Ana Lima',
          authorRole: 'Professora Pre I',
          text: 'Compartilhei com minha coordenacao um modelo de observacao semanal e funcionou muito bem.',
          category: 'relato' as const,
          likes: 31,
          comments: 5,
          createdAt: 'Ontem, 17h12',
        },
      ],
      activeClassId: null as string | null,
      activeStudentId: null as string | null,
      isCommunityEnabled: (): boolean => {
        const state = get()
        return state.communityAccess.global || state.communityAccess.allowedUserIds.includes(state.userId)
      },
      hydrateWorkspace: (data) =>
        set({
          userId: data.userId,
          userName: data.userName,
          schoolName: data.schoolName,
          classes: data.classes,
          annotations: data.annotations ?? [],
          attendanceRecords: data.attendanceRecords ?? [],
          activeClassId: data.classes[0]?.id ?? null,
          activeStudentId: null,
        }),
      setUserName: (name: string) => set({ userName: name }),
      setSchoolName: (name: string) => set({ schoolName: name }),
      addAnnotation: (ann: Annotation) =>
        set((state) => ({ annotations: [ann, ...state.annotations] })),
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
                          annotationCount: student.annotationCount + 1,
                          timeline: [event, ...(student.timeline ?? [])],
                        }
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
