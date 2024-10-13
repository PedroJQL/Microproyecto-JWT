import pool from './db/pg.js'
import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { SALT_ROUNDS, JWT_SECRET } from './config.js'

// Validador de datos de usuario
const userSchema = z.object({
  username: z.string().min(6, { message: 'Username must be at least 6 characters long' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long' }),
  balance: z.number().min(10, { message: 'Initial balance must be a non-negative number' }).optional(),
  nombre: z.string().min(3, { message: 'Nombre must be at least 6 characters long' }),
  apellido: z.string().min(3, { message: 'Apellido must be at least 8 characters long' }),
  email: z.string().min(5, { message: 'Correo must be at least 8 characters long' })
})

const loginSchema = z.object({
  username: z.string().nonempty('El nombre de usuario es requerido'),
  password: z.string().nonempty('La contraseña es requerida')
})

export class UserRepository {
  static async create ({ username, password, balance, nombre, apellido, email }) {
    // Validamos los datos usando el esquema
    userSchema.parse({ username, password, balance, nombre, apellido, email })

    const client = await pool.connect()
    try {
      // Verificamos si el nombre de usuario ya existe
      const { rows } = await client.query('SELECT * FROM users WHERE username = $1', [username])
      if (rows.length > 0) throw new Error('El nombre de usuario ya existe')

      // Generamos un ID único para el usuario y encriptamos la contraseña
      const id = crypto.randomUUID()
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

      // Insertamos el nuevo usuario en la base de datos incluyendo nombre y apellido
      await client.query(
        'INSERT INTO users (_id, username, password, password_changed, balance, nombre, apellido, email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [id, username, hashedPassword, false, balance, nombre, apellido, email]
      )

      return id
    } finally {
      client.release()
    }
  }

  static async login ({ username, password }) {
    loginSchema.parse({ username, password })

    const client = await pool.connect()
    try {
      const { rows } = await client.query('SELECT * FROM users WHERE username = $1', [username])
      if (rows.length === 0) throw new Error('El nombre de usuario no existe')

      const user = rows[0]
      const isValid = await bcrypt.compare(password, user.password)
      if (!isValid) throw new Error('La contraseña es inválida')

      const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' })

      return {
        token,
        user: {
          _id: user._id,
          username: user.username,
          changePassword: !user.password_changed
        }
      }
    } finally {
      client.release()
    }
  }

  static async updatePassword ({ userId, newPassword }) {
    const passwordSchema = z.string().min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    passwordSchema.parse(newPassword)

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS)
    const client = await pool.connect()
    try {
      const { rowCount } = await client.query(
        'UPDATE users SET password = $1 WHERE _id = $2 AND password_changed = true',
        [hashedPassword, userId]
      )
      if (rowCount === 0) throw new Error('No se pudo actualizar la contraseña o el usuario no ha cambiado su contraseña inicial')
    } finally {
      client.release()
    }
  }

  static async initialPasswordChange ({ userId, newPassword }) {
    const passwordSchema = z.string().min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    passwordSchema.parse(newPassword)

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS)
    const client = await pool.connect()
    try {
      const { rowCount } = await client.query(
        'UPDATE users SET password = $1, password_changed = true WHERE _id = $2 AND password_changed = false',
        [hashedPassword, userId]
      )
      if (rowCount === 0) throw new Error('No se pudo actualizar la contraseña inicial o ya ha sido cambiada')
    } finally {
      client.release()
    }
  }

  static async transferBalance (fromUserId, toUsername, amount) {
    if (amount <= 0) throw new Error('El monto debe ser mayor a cero')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Verificar que el usuario que envía tiene suficientes fondos
      const { rows: fromUserRows } = await client.query('SELECT balance FROM users WHERE _id = $1', [fromUserId])
      if (fromUserRows.length === 0) throw new Error('Usuario remitente no encontrado')

      const fromUser = fromUserRows[0]
      if (fromUser.balance < amount) throw new Error('Fondos insuficientes')

      // Buscar al usuario que recibe el dinero por su nombre de usuario
      const { rows: toUserRows } = await client.query('SELECT _id, balance FROM users WHERE username = $1', [toUsername])
      if (toUserRows.length === 0) throw new Error('Usuario receptor no encontrado')

      const toUser = toUserRows[0]

      // Actualizar balances de ambos usuarios
      await client.query('UPDATE users SET balance = balance - $1 WHERE _id = $2', [amount, fromUserId])
      await client.query('UPDATE users SET balance = balance + $1 WHERE _id = $2', [amount, toUser._id])

      // Registrar la transferencia en la tabla transfers
      await client.query(
        'INSERT INTO transfers (sender_id, receiver_id, amount) VALUES ($1, $2, $3)',
        [fromUserId, toUser._id, amount]
      )

      // Obtener el nuevo balance del remitente
      const { rows: newBalanceRows } = await client.query('SELECT balance FROM users WHERE _id = $1', [fromUserId])
      const newBalance = newBalanceRows[0].balance

      await client.query('COMMIT')

      return { message: 'Transferencia realizada con éxito', newBalance }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  static async getBalance (userId) {
    const client = await pool.connect()
    try {
      const { rows } = await client.query('SELECT username, nombre, apellido, balance FROM users WHERE _id = $1', [userId])

      if (rows.length === 0) throw new Error('Usuario no encontrado')

      const user = rows[0]

      // Asegúrate de que el balance sea un número válido
      const balance = Number(user.balance)
      if (isNaN(balance)) throw new Error('Balance no válido')

      return {
        username: user.username,
        nombre: user.nombre,
        apellido: user.apellido,
        balance
      }
    } finally {
      client.release()
    }
  }
}

// Middleware para verificar el token JWT
export const verifyToken = (req, res, next) => {
  const token = req.cookies.token // Asegúrate de que estás usando cookies para el token

  if (!token) {
    return res.status(401).json({ message: 'No autorizado. Token faltante.' })
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Token no válido.' })
    }

    console.log('Decoded JWT:', decoded) // Verifica que el token contiene el 'id'
    req.user = { id: decoded.id } // Asegúrate de que 'decoded.id' está asignado correctamente
    next()
  })
}
