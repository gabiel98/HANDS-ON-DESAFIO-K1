const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let gpsData = { lat: 0, lon: 0 };
let routeHistory = [];

// Configurações do CallMeBot
const CALLMEBOT_API_KEY = '8048956!'; // Substitua pela sua chave API
const CALLMEBOT_PHONE_NUMBER = '+559591154697!'; // Substitua pelo seu número de telefone

// Localização alvo (defina aqui a latitude e longitude desejada)
const TARGET_LOCATION = { lat: 2.836573, lon: -60.691414 }; // Exemplo: Coordenadas de São Paulo

// Função para calcular a distância entre duas coordenadas usando a fórmula de Haversine
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180; // Converte latitude 1 para radianos
  const φ2 = (lat2 * Math.PI) / 180; // Converte latitude 2 para radianos
  const Δφ = ((lat2 - lat1) * Math.PI) / 180; // Diferença de latitudes
  const Δλ = ((lon2 - lon1) * Math.PI) / 180; // Diferença de longitudes

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distância em metros
}

// Função para enviar mensagem via CallMeBot
async function sendWhatsAppMessage(message) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${CALLMEBOT_PHONE_NUMBER}&text=${encodeURIComponent(message)}&apikey=${CALLMEBOT_API_KEY}`;
  try {
    await axios.get(url);
    console.log('Mensagem enviada com sucesso!');
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
  }
}

// Rota principal (frontend)
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Localização da Ambulância</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
        <script src="/socket.io/socket.io.js"></script>
      </head>
      <body>
        <h1>Localização Atual</h1>
        <p>Latitude: <span id="lat">${gpsData.lat}</span></p>
        <p>Longitude: <span id="lon">${gpsData.lon}</span></p>
        <div id="map" style="width: 100%; height: 500px;"></div>
        <script>
          var map, marker, polyline;

          // Inicializa o mapa
          function initMap(lat, lon) {
            map = L.map('map').setView([lat, lon], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
            marker = L.marker([lat, lon]).addTo(map).bindPopup("Ambulância");
          }

          // Conexão com o WebSocket
          const socket = io();
          socket.on('update', (data) => {
            // Atualiza os valores de latitude e longitude
            document.getElementById('lat').textContent = data.lat;
            document.getElementById('lon').textContent = data.lon;

            // Move o marcador
            if (!map) initMap(data.lat, data.lon); // Inicializa o mapa na primeira atualização
            marker.setLatLng([data.lat, data.lon]);
            
            // Atualiza a rota
            if (polyline) polyline.addLatLng([data.lat, data.lon]);
            else polyline = L.polyline([[data.lat, data.lon]], { color: 'red' }).addTo(map);
          });
        </script>
      </body>
    </html>
  `);
});

// Rota para atualizar a localização
app.get("/update", async (req, res) => {
  if (req.query.lat && req.query.lon) {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    gpsData = { lat, lon };
    routeHistory.push([lat, lon]);

    // Envia a atualização para todos os clientes via Socket.io
    io.emit("update", gpsData);

    // Calcula a distância até o alvo
    const distance = calculateDistance(lat, lon, TARGET_LOCATION.lat, TARGET_LOCATION.lon);

    // Se a distância for menor ou igual a 100 metros, envia uma mensagem
    if (distance <= 100) {
      const message = `A ambulância está a ${distance.toFixed(2)} metros do local alvo!`;
      await sendWhatsAppMessage(message);
    }

    res.send("Localização atualizada!");
  } else {
    res.status(400).send("Coordenadas inválidas!");
  }
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));