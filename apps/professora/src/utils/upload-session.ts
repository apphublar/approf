/** Mantém arquivos selecionados entre remontagens (ex.: ao abrir o seletor nativo no celular). */
let documentsSelectedFile: File | null = null
let verificationPendingFiles: File[] = []

export function stashDocumentsSelectedFile(file: File | null) {
  documentsSelectedFile = file
}

export function peekDocumentsSelectedFile() {
  return documentsSelectedFile
}

export function stashVerificationPendingFiles(files: File[]) {
  verificationPendingFiles = files
}

export function peekVerificationPendingFiles() {
  return verificationPendingFiles
}

export function clearVerificationPendingFiles() {
  verificationPendingFiles = []
}
