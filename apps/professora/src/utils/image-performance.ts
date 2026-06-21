export interface ImageVariants {
  originalUrl: string
  mediumUrl: string
  thumbnailUrl: string
  mimeType: string
  fileSize: number
  width: number
  height: number
}

const VARIANT_CACHE_LIMIT = 80
const DEFAULT_UPLOAD_MAX_SIDE = 1280
const DEFAULT_UPLOAD_MAX_BYTES = 700_000
const variantCache = new Map<string, Promise<ImageVariants>>()

export async function compressImageFileForUpload(
  file: File,
  options: { maxSide?: number; maxBytes?: number } = {},
): Promise<{ dataUrl: string; name: string }> {
  const maxSide = options.maxSide ?? DEFAULT_UPLOAD_MAX_SIDE
  const maxBytes = options.maxBytes ?? DEFAULT_UPLOAD_MAX_BYTES
  const bitmap = await createImageBitmap(file)

  try {
    let side = maxSide
    let quality = 0.82

    for (let round = 0; round < 8; round += 1) {
      const blob = await renderResized(bitmap, side, quality)
      if (blob.size <= maxBytes) {
        return {
          dataUrl: await blobToDataUrl(blob),
          name: toWebpName(file.name),
        }
      }

      if (quality > 0.58) {
        quality -= 0.07
      } else {
        side = Math.max(640, Math.round(side * 0.85))
        quality = 0.82
      }
    }

    const blob = await renderResized(bitmap, 640, 0.6)
    return {
      dataUrl: await blobToDataUrl(blob),
      name: toWebpName(file.name),
    }
  } finally {
    bitmap.close()
  }
}

export function estimateDataUrlBytes(dataUrl: string) {
  if (!dataUrl.startsWith('data:')) return 0
  const base64 = dataUrl.split(',')[1] ?? ''
  return Math.floor((base64.length * 3) / 4)
}

export function prefetchImageVariants(sourceUrl: string, cacheKey: string) {
  void getImageVariants(sourceUrl, cacheKey).catch(() => undefined)
}

export function getImageVariants(sourceUrl: string, cacheKey: string): Promise<ImageVariants> {
  const resolvedKey = `${cacheKey}:${sourceUrl.slice(0, 64)}:${sourceUrl.length}`
  const cached = variantCache.get(resolvedKey)
  if (cached) return cached

  const promise = buildVariants(sourceUrl).catch((error) => {
    variantCache.delete(resolvedKey)
    throw error
  })
  variantCache.set(resolvedKey, promise)
  cleanupVariantCache()
  return promise
}

async function buildVariants(sourceUrl: string): Promise<ImageVariants> {
  const metadata = await readImageMetadata(sourceUrl)
  if (!sourceUrl.startsWith('data:image/')) {
    return {
      originalUrl: sourceUrl,
      mediumUrl: sourceUrl,
      thumbnailUrl: sourceUrl,
      mimeType: metadata.mimeType,
      fileSize: metadata.fileSize,
      width: metadata.width,
      height: metadata.height,
    }
  }

  const originalBlob = dataUrlToBlob(sourceUrl)
  const imageBitmap = await createImageBitmap(originalBlob)
  const width = imageBitmap.width
  const height = imageBitmap.height
  const mediumBlob = await renderResized(imageBitmap, 1280, 0.8)
  const thumbnailBlob = await renderResized(imageBitmap, 320, 0.72)
  imageBitmap.close()

  return {
    originalUrl: sourceUrl,
    mediumUrl: URL.createObjectURL(mediumBlob),
    thumbnailUrl: URL.createObjectURL(thumbnailBlob),
    mimeType: metadata.mimeType,
    fileSize: metadata.fileSize,
    width,
    height,
  }
}

async function readImageMetadata(sourceUrl: string) {
  const mimeMatch = sourceUrl.match(/^data:([^;]+);base64,/)
  const mimeType = mimeMatch?.[1] ?? 'image/png'
  const fileSize = sourceUrl.startsWith('data:') ? estimateDataUrlSize(sourceUrl) : 0
  if (!sourceUrl.startsWith('data:image/')) {
    return { mimeType, fileSize, width: 0, height: 0 }
  }

  const blob = dataUrlToBlob(sourceUrl)
  const bitmap = await createImageBitmap(blob)
  const width = bitmap.width
  const height = bitmap.height
  bitmap.close()
  return { mimeType, fileSize, width, height }
}

async function renderResized(source: ImageBitmap, maxSide: number, quality: number) {
  const ratio = Math.min(1, maxSide / Math.max(source.width, source.height))
  const targetWidth = Math.max(1, Math.round(source.width * ratio))
  const targetHeight = Math.max(1, Math.round(source.height * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não disponível para otimizar imagem.')
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => {
      if (!next) {
        reject(new Error('Falha ao converter imagem otimizada.'))
        return
      }
      resolve(next)
    }, 'image/webp', quality)
  })
  return blob
}

function dataUrlToBlob(dataUrl: string) {
  const [header, content] = dataUrl.split(',')
  const mimeType = header.match(/data:(.*?);base64/)?.[1] ?? 'image/png'
  const bytes = Uint8Array.from(atob(content ?? ''), (char) => char.charCodeAt(0))
  return new Blob([bytes], { type: mimeType })
}

function estimateDataUrlSize(dataUrl: string) {
  return estimateDataUrlBytes(dataUrl)
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Falha ao preparar imagem.'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao preparar imagem.'))
    reader.readAsDataURL(blob)
  })
}

function toWebpName(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, '') || 'imagem'
  return `${base}.webp`
}

function cleanupVariantCache() {
  if (variantCache.size <= VARIANT_CACHE_LIMIT) return
  const extra = variantCache.size - VARIANT_CACHE_LIMIT
  for (let index = 0; index < extra; index += 1) {
    const key = variantCache.keys().next().value as string | undefined
    if (!key) break
    variantCache.delete(key)
  }
}
