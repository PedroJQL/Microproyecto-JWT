import jwt from 'jsonwebtoken'
import { JWT_SECRET } from './config.js'

export const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, username: user.username },
    JWT_SECRET,
    { expiresIn: '1h' }
  )
}

export const generateTempToken = (user) => {
  return jwt.sign(
    { id: user._id, changePassword: true },
    JWT_SECRET,
    { expiresIn: '15m' }
  )
}
