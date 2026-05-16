import { useNavStore } from '@/store'
import BottomNav from './BottomNav'
import HomeScreen from '@/screens/Home'
import AnnotationsScreen from '@/screens/Annotations'
import ClassesScreen from '@/screens/Classes'
import AchievementsScreen from '@/screens/Achievements'
import MaterialsScreen from '@/screens/Materials'
import NewAnnotationSubscreen from '@/subscreens/NewAnnotation'
import ClassStudentsSubscreen from '@/subscreens/ClassStudents'
import StudentProfileSubscreen from '@/subscreens/StudentProfile'
import ReportSubscreen from '@/subscreens/Report'
import AiPedagogicaSubscreen from '@/subscreens/AiPedagogica'
import CalendarSubscreen from '@/subscreens/Calendar'
import CommunitySubscreen from '@/subscreens/Community'
import NewClassSubscreen from '@/subscreens/NewClass'
import NewStudentSubscreen from '@/subscreens/NewStudent'
import EditClassSubscreen from '@/subscreens/EditClass'
import EditStudentSubscreen from '@/subscreens/EditStudent'
import FindChildSubscreen from '@/subscreens/FindChild'
import TransferStudentSubscreen from '@/subscreens/TransferStudent'
import NewTimelineEventSubscreen from '@/subscreens/NewTimelineEvent'
import PedagogicalGeneratorSubscreen from '@/subscreens/PedagogicalGenerator'
import DocumentsSubscreen from '@/subscreens/Documents'
import DocumentDetailSubscreen from '@/subscreens/DocumentDetail'
import PendingSubscreen from '@/subscreens/Pending'
import GizTokensSubscreen from '@/subscreens/GizTokens'
import GeneratedDocumentsSubscreen from '@/subscreens/GeneratedDocuments'

export default function AppShell() {
  const { activeTab, subscreens } = useNavStore()

  return (
    <div id="app-root" className="flex flex-col">
      {/* Tab screens */}
      <div className="absolute inset-0 overflow-hidden">
        <TabPage id="home"         active={activeTab === 'home'}><HomeScreen /></TabPage>
        <TabPage id="annotations"  active={activeTab === 'annotations'}><AnnotationsScreen /></TabPage>
        <TabPage id="classes"      active={activeTab === 'classes'}><ClassesScreen /></TabPage>
        <TabPage id="achievements" active={activeTab === 'achievements'}><AchievementsScreen /></TabPage>
        <TabPage id="materials"    active={activeTab === 'materials'}><MaterialsScreen /></TabPage>
      </div>

      {/* Subscreens (stacked, rendered at root level — above nav) */}
      {subscreens.map((frame, i) => {
        const isTop = i === subscreens.length - 1
        const isPrev = i === subscreens.length - 2
        return (
          <SubscreenWrapper key={`${frame.screen}-${i}`} isTop={isTop} isPrev={isPrev}>
            {renderSubscreen(frame.screen, frame.data)}
          </SubscreenWrapper>
        )
      })}

      <BottomNav />
    </div>
  )
}

function TabPage({ active, children }: { id: string; active: boolean; children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 flex flex-col bg-cream overflow-hidden"
      style={{ display: active ? 'flex' : 'none', zIndex: active ? 2 : 1 }}
    >
      {children}
    </div>
  )
}

function SubscreenWrapper({
  isTop,
  isPrev,
  children,
}: {
  isTop: boolean
  isPrev: boolean
  children: React.ReactNode
}) {
  const translateX = isTop ? '0%' : isPrev ? '-28%' : '-100%'
  return (
    <div
      className="absolute inset-0 flex flex-col bg-cream overflow-hidden"
      style={{
        zIndex: 120,
        transform: `translateX(${translateX})`,
        transition: 'transform 0.26s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {children}
    </div>
  )
}

function renderSubscreen(screen: string, data?: unknown) {
  switch (screen) {
    case 'new-annotation':  return <NewAnnotationSubscreen />
    case 'class-students':  return <ClassStudentsSubscreen />
    case 'student-profile': return <StudentProfileSubscreen />
    case 'report':          return <ReportSubscreen data={data} />
    case 'ai':              return <AiPedagogicaSubscreen />
    case 'giztokens':       return <GizTokensSubscreen />
    case 'calendar':        return <CalendarSubscreen />
    case 'community':       return <CommunitySubscreen />
    case 'new-class':       return <NewClassSubscreen />
    case 'new-student':     return <NewStudentSubscreen />
    case 'edit-class':      return <EditClassSubscreen />
    case 'edit-student':    return <EditStudentSubscreen />
    case 'find-child':      return <FindChildSubscreen />
    case 'transfer-student': return <TransferStudentSubscreen />
    case 'new-timeline-event': return <NewTimelineEventSubscreen />
    case 'pedagogical-generator': return <PedagogicalGeneratorSubscreen data={data} />
    case 'documents':       return <DocumentsSubscreen data={data} />
    case 'generated-documents': return <GeneratedDocumentsSubscreen data={data} />
    case 'document-detail': return <DocumentDetailSubscreen data={data} />
    case 'pending':         return <PendingSubscreen />
    default:                return null
  }
}
