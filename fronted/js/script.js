/* eslint-disable no-undef */
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault()

  const username = document.getElementById('usuario').value
  const password = document.getElementById('contrasena').value

  try {
    const response = await fetch('http://192.168.1.39:3030/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include'
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Error en el inicio de sesión')
    }

    const data = await response.json()
    console.log('Respuesta del servidor:', data) // Para depuración

    if (data.changePassword) {
      window.location.href = `/changepwd.html?userId=${data.id}`
    } else {
      window.location.href = `/Perfil.html?userId=${data.id}`
    }
  } catch (error) {
    console.error('Error durante el inicio de sesión:', error)
    alert('Error: ' + error.message)
  }
})
