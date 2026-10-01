import react from '@vitejs/plugin-react'
import { networkInterfaces } from 'node:os'
import { defineConfig, type Plugin } from 'vite'

const sessionPort = Number(process.env.SOCKET_PORT || 3001)

const pairOriginPlugin: Plugin = {
  name: 'local-pair-origin',
  configureServer(server) {
    server.middlewares.use('/__pair-origin', (_request, response) => {
      const addresses = Object.values(networkInterfaces()).flatMap((entries) => entries ?? [])
        .filter((entry) => entry.family === 'IPv4' && !entry.internal)
        .map((entry) => entry.address)
      const isPrivateAddress = (address: string) => address.startsWith('192.168.') || address.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(address)
      const address = addresses.find(isPrivateAddress) ?? addresses[0]
      const listeningAddress = server.httpServer?.address()
      const port = typeof listeningAddress === 'object' && listeningAddress ? listeningAddress.port : 5173
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ origin: address ? `http://${address}:${port}` : '' }))
    })
  },
}

export default defineConfig({
  plugins: [react(), pairOriginPlugin],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/socket.io': {
        target: `http://localhost:${sessionPort}`,
        ws: true,
      },
    },
  },
})
