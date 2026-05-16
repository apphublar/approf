'use client'

interface PublicReportActionsProps {
  title: string
  html: string
  imageDataUrl?: string
}

export function PublicReportActions({ title, html, imageDataUrl }: PublicReportActionsProps) {
  function printOrSavePdf() {
    window.print()
  }

  function downloadWord() {
    const blob = new Blob(['\ufeff', buildExportHtml(title, html)], { type: 'application/msword;charset=utf-8' })
    downloadBlob(blob, `${slugify(title)}.doc`)
  }

  async function shareLink() {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title, text: 'Documento gerado pelo Approf', url })
      return
    }
    await navigator.clipboard.writeText(url)
    window.alert('Link copiado.')
  }

  function downloadImage() {
    if (!imageDataUrl) return
    downloadBlob(dataUrlToBlob(imageDataUrl), 'imagem-approf.png')
  }

  return (
    <div className="public-actions">
      <button onClick={printOrSavePdf}>Baixar PDF / imprimir</button>
      <button onClick={downloadWord}>Baixar Word</button>
      <button onClick={shareLink}>Compartilhar link</button>
      {imageDataUrl && <button onClick={downloadImage}>Baixar imagem</button>}
    </div>
  )
}

function buildExportHtml(title: string, bodyHtml: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 2.5cm 2cm 2cm 3cm; }
    body { font-family: Arial, sans-serif; color: #111; font-size: 12pt; line-height: 1.5; }
    h1 { text-align: center; font-size: 14pt; text-transform: uppercase; margin-bottom: 24pt; }
    p { text-align: justify; margin: 0 0 12pt; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${bodyHtml}
</body>
</html>`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function dataUrlToBlob(dataUrl: string) {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? 'image/png'
  const binary = atob(data ?? '')
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mime })
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'documento-approf'
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
