import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'christian.aecp@gmail.com',
    pass: '23|/My)pS6P{' // Use la contraseña de aplicación generada aquí
  }
})

export default transporter
