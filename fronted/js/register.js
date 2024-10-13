document.getElementById('registerForm').addEventListener('submit', async (event) => {
  event.preventDefault() // Evita el envío del formulario por defecto

  const nombre = document.getElementById('nombre').value
  const apellido = document.getElementById('apellido').value
  const username = document.getElementById('username').value
  const email = document.getElementById('correo').value
  const password = document.getElementById('password').value
  const balance = parseFloat(document.getElementById('balance').value) // Suponiendo que tienes un campo para balance

  try {
    const response = await fetch('http://192.168.1.39:3030/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password, balance, nombre, apellido, email }) // Envía username, password y balance
    })

    if (!response.ok) {
      const errorMessage = await response.text()
      throw new Error(errorMessage) // Lanza un error si la respuesta no es OK
    }

    // eslint-disable-next-line no-unused-vars
    const data = await response.json()
    // eslint-disable-next-line no-undef
    alert('Usuario registrado')
    document.getElementById('registerForm').reset()
    // Redirige o actualiza la UI según sea necesario
  } catch (error) {
    // eslint-disable-next-line no-undef
    alert('Nombre de usuario no disponible.')
    console.error(error) // Muestra el error en la consola para más detalles
  }
})
