/* eslint-disable no-undef */
document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const newPassword = document.getElementById('newPasswordInput').value

  try {
    const response = await fetch('http:// 192.168.1.39:3030/initial-change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Esto es necesario para enviar las cookies
      body: JSON.stringify({ newPassword })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Error al cambiar la contraseña')
    }

    const data = await response.json()
    alert(data.message) // Muestra el mensaje de éxito
    window.location.href = '/index.html' // Redirige al dashboard o página principal
  } catch (error) {
    console.error('Error:', error)
    alert('Error al cambiar la contraseña: ' + error.message)
  }
})
