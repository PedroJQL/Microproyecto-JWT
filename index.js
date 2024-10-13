/* eslint-disable no-undef */
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import { JWT_SECRET, PORT } from './config.js'
import pool from './db/pg.js'
import { UserRepository, verifyToken } from './user-repository.js'

const app = express()

// Ruta absoluta del directorio actual
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuración de CORS
app.use(cors({
  origin: 'http://localhost:3030', // Ajusta esto a la URL de tu frontend
  credentials: true
}))

// Middleware para manejar cookies y JSON
app.use(express.json())
app.use(cookieParser())

// Sirviendo archivos estáticos de la carpeta 'fronted'
app.use(express.static(path.join(__dirname, 'fronted')))

// Función para generar tokens JWT
const generateToken = (user, expiresIn = '1h') => {
  return jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn }) // Cambia a _id
}

// Middleware para autenticar el token
export const authenticateToken = (req, res, next) => {
  const token = req.cookies.token // Tomamos el token desde las cookies

  if (!token) {
    return res.status(401).json({ message: 'Acceso no autorizado, token no encontrado' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded // Decodificar y adjuntar la información del usuario al request
    next() // Continuar al siguiente middleware o ruta
  } catch (error) {
    console.error('Error al verificar el token:', error)
    return res.status(403).json({ message: 'Token inválido o expirado' })
  }
}

// Ruta principal (sirve el archivo HTML principal)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'fronted', 'index.html'))
})

// Ruta de inicio de sesión
// Ruta de inicio de sesión
app.post('/login', async (req, res) => {
  const { username, password } = req.body

  try {
    const result = await UserRepository.login({ username, password })

    if (result.user.changePassword) {
      // Generar un token temporal para el cambio de contraseña inicial
      const tempToken = generateToken(result.user, '15m')
      res.cookie('tempToken', tempToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 900000, // 15 minutos
        sameSite: 'lax'
      })
      return res.json({
        id: result.user._id,
        username: result.user.username,
        changePassword: true
      })
    }

    const token = result.token
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 3600000, // 1 hora
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    })

    return res.json({
      id: result.user._id,
      username: result.user.username
    })
  } catch (error) {
    console.error('Error en login:', error)
    return res.status(400).json({ message: error.message })
  }
})

// Nueva ruta para el cambio de contraseña inicial
app.post('/initial-change-password', async (req, res) => {
  console.log('Recibida solicitud de cambio de contraseña inicial')
  const { newPassword } = req.body
  console.log('Cookies recibidas:', req.cookies)
  const tempToken = req.cookies.tempToken

  if (!tempToken) {
    console.log('No se encontró el token temporal en las cookies')
    return res.status(401).json({ message: 'No autorizado. Token temporal faltante.' })
  }

  try {
    console.log('Intentando verificar el token temporal')
    const decoded = jwt.verify(tempToken, JWT_SECRET)
    console.log('Token decodificado:', decoded)

    if (!decoded.id) {
      console.log('Token no contiene ID de usuario')
      return res.status(400).json({ message: 'Token inválido' })
    }

    console.log('Intentando cambiar la contraseña para el usuario:', decoded.id)
    await UserRepository.initialPasswordChange({ userId: decoded.id, newPassword })

    console.log('Contraseña cambiada exitosamente')

    // Limpiar la cookie del token temporal
    res.clearCookie('tempToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    })
    console.log('Cookie tempToken eliminada')

    // Generar un nuevo token JWT normal
    const newToken = jwt.sign({ id: decoded.id }, JWT_SECRET, { expiresIn: '1h' })
    console.log('Nuevo token generado:', newToken)

    // Establecer el nuevo token como cookie
    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3600000, // 1 hora
      sameSite: 'strict'
    })
    console.log('Nueva cookie token establecida')

    res.status(200).json({ message: 'Contraseña actualizada con éxito' })
  } catch (error) {
    console.error('Error durante el cambio de contraseña:', error)
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Token inválido o expirado' })
    }
    res.status(400).json({ message: error.message })
  }
})

// Ruta de cambio de contraseña (para cambios posteriores)
app.post('/change-password', verifyToken, async (req, res) => {
  const { newPassword } = req.body

  try {
    await UserRepository.updatePassword({ userId: req.user.id, newPassword })
    res.status(200).json({ message: 'Contraseña actualizada con éxito' })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

// Ruta de registro de usuarios
app.post('/register', async (req, res) => {
  // Extraemos los nuevos campos del cuerpo de la solicitud
  const { username, password, balance, nombre, apellido, email } = req.body

  try {
    // Pasamos los nuevos valores a la función create del repositorio
    const id = await UserRepository.create({ username, password, balance, nombre, apellido, email })
    res.status(201).json({ id })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

// Ruta para obtener el balance del usuario
app.get('/balance', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id
    console.log('User ID:', userId) // Asegúrate de que el ID es correcto
    const balanceData = await UserRepository.getBalance(userId)
    res.json(balanceData)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el balance', error: error.message })
  }
})
// Ruta de Tranferencias
app.post('/transfer', verifyToken, async (req, res) => {
  const { recipient, amount } = req.body
  const senderId = req.user.id // Cambiado de _id a id

  if (!senderId) {
    return res.status(401).json({ message: 'Usuario no autenticado' })
  }

  if (!recipient || !amount || amount <= 0) {
    return res.status(400).json({ message: 'Datos inválidos' })
  }

  try {
    const result = await UserRepository.transferBalance(senderId, recipient, parseFloat(amount))
    res.json({ message: result.message, newBalance: result.newBalance })
  } catch (error) {
    console.error('Error en la transferencia:', error)
    res.status(400).json({ message: error.message })
  }
})
// Ruta de historial de transeferencias
app.get('/transfer-history', verifyToken, async (req, res) => {
  const userId = req.user.id
  const client = await pool.connect()

  try {
    const { rows } = await client.query(`
      SELECT 
        t.id, 
        t.amount, 
        t.created_at, 
        CASE 
          WHEN t.sender_id = $1 THEN 'sent'
          ELSE 'received'
        END AS type,
        CASE 
          WHEN t.sender_id = $1 THEN receiver.username
          ELSE sender.username
        END AS other_party
      FROM transfers t
      JOIN users sender ON t.sender_id = sender._id
      JOIN users receiver ON t.receiver_id = receiver._id
      WHERE t.sender_id = $1 OR t.receiver_id = $1
      ORDER BY t.created_at DESC
      LIMIT 50
    `, [userId])

    res.json(rows)
  } catch (error) {
    console.error('Error fetching transfer history:', error)
    res.status(500).json({ message: 'Error al obtener el historial de transferencias' })
  } finally {
    client.release()
  }
})
// Ruta para cerrar sesión (logout)
app.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  })
  res.json({ message: 'Sesión cerrada con éxito' })
})

// Ruta protegida de ejemplo
app.post('/protected', verifyToken, (req, res) => {
  res.json({ user: req.user })
})

// Inicio del servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`)
})
