import { Download, FileUp, FolderPlus, UploadCloud } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { materialCategories, materials } from '../lib/mock-admin-data'

export default function MaterialsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Material de apoio"
        title="Biblioteca das professoras"
        description="Suba arquivos por categoria, publique quando estiver pronto e disponibilize para download no app PWA."
        action={
          <div className="action-row">
            <button className="quiet-button secondary-action">
              <FolderPlus size={15} />
              Categoria
            </button>
            <button className="quiet-button">
              <FileUp size={15} />
              Novo material
            </button>
          </div>
        }
      />

      <section className="content-grid">
        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Upload</p>
              <h2>Enviar novo arquivo</h2>
            </div>
            <UploadCloud size={22} />
          </div>

          <div className="upload-zone">
            <UploadCloud size={30} />
            <strong>Arraste o arquivo aqui ou selecione no computador</strong>
            <span>PDF, DOCX, PPTX, XLSX ou imagem. O upload real entra quando o Supabase Storage estiver conectado.</span>
          </div>

          <div className="form-grid">
            <label>
              Titulo
              <input placeholder="Ex: Modelo de relatorio semestral" />
            </label>
            <label>
              Categoria
              <select defaultValue="Modelos de Relatorio">
                {materialCategories.map((category) => (
                  <option key={category.name}>{category.name}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select defaultValue="draft">
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="archived">Arquivado</option>
              </select>
            </label>
            <label>
              Descricao
              <textarea placeholder="Resumo para a professora entender quando usar este material." />
            </label>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Categorias</p>
              <h2>Organizacao</h2>
            </div>
          </div>
          <div className="stack-list">
            {materialCategories.map((category) => (
              <div className="stack-item" key={category.name}>
                <span>
                  <strong>{category.name}</strong>
                  <small>{category.published} publicados de {category.count}</small>
                </span>
                <span className="mini-count">{category.count}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <article className="panel spaced-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Arquivos</p>
            <h2>Materiais cadastrados</h2>
          </div>
          <span className="status-pill">
            <Download size={16} />
            Professoras baixam publicados
          </span>
        </div>

        <div className="table">
          <div className="table-row table-head materials-grid">
            <span>Material</span>
            <span>Categoria</span>
            <span>Tipo</span>
            <span>Status</span>
            <span>Downloads</span>
            <span>Atualizado</span>
          </div>
          {materials.map((material) => (
            <div className="table-row materials-grid" key={material.title}>
              <strong>{material.title}</strong>
              <span>{material.category}</span>
              <span>{material.type}</span>
              <StatusBadge status={material.status} />
              <span>{material.downloads}</span>
              <span>{material.updatedAt}</span>
            </div>
          ))}
        </div>
      </article>
    </>
  )
}
