const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

export function generateCoordinatorAccessPassword() {
  let result = ''
  for (let index = 0; index < 6; index += 1) {
    result += PASSWORD_CHARS[Math.floor(Math.random() * PASSWORD_CHARS.length)]
  }
  return result
}

export function isValidCoordinatorAccessPassword(value: string) {
  return /^[A-Za-z0-9]{6}$/.test(value.trim())
}
