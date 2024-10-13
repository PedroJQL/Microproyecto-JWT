import { createHash } from 'crypto'
import axios from 'axios'

function createSHA1Hash (input) {
  return createHash('sha1').update(input).digest('hex').toUpperCase()
}

async function createSHA1HashWebCrypto (input) {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export async function isPasswordBreached (password) {
  let sha1Password
  try {
    sha1Password = createSHA1Hash(password)
  } catch (error) {
    console.error('Error al usar crypto.createHash, intentando con Web Crypto API')
    sha1Password = await createSHA1HashWebCrypto(password)
  }

  const prefix = sha1Password.slice(0, 5)
  const suffix = sha1Password.slice(5)

  try {
    const response = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`)

    const breachedPasswords = response.data.split('\n')
    for (const breachedPassword of breachedPasswords) {
      const [hashSuffix, count] = breachedPassword.split(':')
      if (hashSuffix === suffix) {
        return parseInt(count, 10)
      }
    }

    return 0
  } catch (error) {
    console.error('Error al verificar la contraseña:', error)
    return null
  }
}
