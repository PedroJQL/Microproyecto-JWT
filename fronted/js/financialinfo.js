/* eslint-disable no-undef */
document.addEventListener('DOMContentLoaded', () => {
  const financialInfoDiv = document.getElementById('financialInfo')
  const transferButton = document.getElementById('transferButton')
  const logoutButton = document.getElementById('logoutButton')
  const ctx = document.getElementById('financialChart').getContext('2d')
  let chart

  // Función para cargar datos financieros
  const loadFinancialData = async () => {
    try {
      const response = await fetch('http://192.168.1.39:3030/balance', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/index.html' // Redirigir si no está autorizado
          return
        }
        throw new Error('Error al obtener el Saldo: ' + await response.text())
      }

      const data = await response.json()
      const { balance, nombre, apellido, username } = data

      // Mostrar información del usuario y balance
      financialInfoDiv.innerHTML = `
        <h3>Usuario: ${username}</h3>
        <h3>Nombre: ${nombre} ${apellido}</h3>
        <h3>Saldo: $${balance.toFixed(2)}</h3>
      `

      // Actualizar o crear el gráfico
      updateChart(balance)
    } catch (error) {
      financialInfoDiv.innerHTML = `<p>Error al cargar información financiera: ${error.message}</p>`
    }
  }

  // Función para actualizar el gráfico
  const updateChart = (balance) => {
    const data = {
      labels: ['Saldo Actual'],
      datasets: [{
        label: 'Saldo ($)',
        data: [balance],
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    }

    if (chart) {
      chart.data = data
      chart.update()
    } else {
      chart = new Chart(ctx, {
        type: 'bar',
        data,
        options: {
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      })
    }
  }

  // Manejar transferencia
  transferButton.addEventListener('click', async () => {
    const recipient = document.getElementById('recipient').value
    const amount = parseFloat(document.getElementById('amount').value)

    if (!recipient || isNaN(amount) || amount <= 0) {
      alert('Por favor, introduce un usuario válido y un monto mayor a 0.')
      return
    }

    try {
      const response = await fetch('http://192.168.1.39:3030/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ recipient, amount })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Error al realizar la transferencia')
      }

      const result = await response.json()
      console.log('Respuesta del servidor:', result) // Para depuración

      if (typeof result.newBalance === 'number') {
        alert(`Transferencia realizada con éxito. Nuevo balance: $${result.newBalance.toFixed(2)}`)
      } else {
        alert(`Transferencia realizada con éxito. ${result.message}`)
      }

      // Recargar datos financieros para actualizar el balance mostrado
      loadFinancialData()
      // Recargar el historial de transferencias
      loadTransferHistory()
    } catch (error) {
      console.error('Error durante la transferencia:', error)
      alert(`Error: ${error.message}`)
    }
  })

  // Manejar cierre de sesión
  logoutButton.addEventListener('click', async () => {
    try {
      const response = await fetch('http://192.168.1.39:3030/logout', {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        window.location.href = '/index.html' // Redirigir a la página de inicio de sesión
      } else {
        throw new Error('Error al cerrar sesión')
      }
    } catch (error) {
      alert('Error al cerrar sesión: ' + error.message)
    }
  })

  // Nueva función para cargar el historial de transferencias
  const loadTransferHistory = async () => {
    try {
      const response = await fetch('http://192.168.1.39:3030/transfer-history', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Error al obtener el historial de transferencias')
      }

      const transfers = await response.json()
      const historyContainer = document.getElementById('transferHistory')
      historyContainer.innerHTML = '<h3>Historial de Transferencias</h3>'

      const table = document.createElement('table')
      table.innerHTML = `
        <tr>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Monto</th>
          <th>Otra Parte</th>
        </tr>
      `

      transfers.forEach(transfer => {
        const row = table.insertRow()
        row.innerHTML = `
          <td>${new Date(transfer.created_at).toLocaleString()}</td>
          <td>${transfer.type === 'sent' ? 'Enviado' : 'Recibido'}</td>
          <td>$${parseFloat(transfer.amount).toFixed(2)}</td>
          <td>${transfer.other_party}</td>
        `
      })

      historyContainer.appendChild(table)
    } catch (error) {
      console.error('Error loading transfer history:', error)
      alert('Error al cargar el historial de transferencias')
    }
  }

  // Cargar datos financieros al iniciar la página
  loadFinancialData()

  // Cargar historial de transferencias al iniciar la página
  loadTransferHistory()
})
