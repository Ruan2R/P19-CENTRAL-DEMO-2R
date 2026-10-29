const baseUrl = String(process.env.P16_API_URL || 'http://127.0.0.1:3001').replace(/\/$/, '')

let response
try {
  response = await fetch(`${baseUrl}/api/admin/demo-seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(10_000),
  })
} catch (error) {
  console.error('Não foi possível conectar à API local do P16.')
  console.error('Inicie-a em outro terminal com: npm run api')
  console.error(`Detalhe: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

let result
try { result = await response.json() } catch { result = null }
if (!response.ok) {
  console.error(`A API recusou a carga de demonstração (HTTP ${response.status}).`)
  console.error(result?.message || result?.error || 'Confira o terminal da API.')
  process.exit(1)
}

if (result?.alreadySeeded) {
  console.log('Os dados de demonstração desta versão já foram adicionados; nada foi duplicado.')
  console.log(`Catálogo atual: ${result.products} produtos; ${result.orders} pedidos.`)
} else {
  console.log('Dados de demonstração adicionados ao armazenamento local do P16.')
  console.log(`Produtos/insumos novos: ${result.newProducts}`)
  console.log(`Movimentações financeiras: ${result.newEntries}`)
  console.log(`Contas a pagar: ${result.newPayables}`)
  console.log(`Valores a receber: ${result.newReceivables}`)
  console.log(`Pedidos de exemplo: ${result.newOrders}`)
  console.log('Valores são fictícios e servem apenas para testar os fluxos.')
}
