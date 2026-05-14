import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { teachers } from '../lib/mock-admin-data'

export default function TeachersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Professoras"
        title="Usuarias cadastradas"
        description="Acompanhe cadastros, turmas, alunos e status de acesso antes de conectar ao Supabase."
        action={<button className="quiet-button">Cadastrar manualmente</button>}
      />

      <article className="panel">
        <div className="table">
          <div className="table-row table-head teachers-page-grid">
            <span>Professora</span>
            <span>Status</span>
            <span>Escola</span>
            <span>Turmas</span>
            <span>Alunos</span>
            <span>IA</span>
          </div>
          {teachers.map((teacher) => (
            <div className="table-row teachers-page-grid" key={teacher.email}>
              <span>
                <strong>{teacher.name}</strong>
                <small>{teacher.email}</small>
              </span>
              <StatusBadge status={teacher.status} />
              <span>{teacher.school}</span>
              <span>{teacher.classes}</span>
              <span>{teacher.students}</span>
              <span>{teacher.aiReports}</span>
            </div>
          ))}
        </div>
      </article>
    </>
  )
}
