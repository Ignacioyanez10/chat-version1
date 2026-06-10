const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

//consuma datos de la carpeta public

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log(`Un usuario se ha conectado (ID: ${socket.id})`);

    //escuchar cuando el usuario defina su nombre
    socket.on('nuevoUsuario', (nombre) => {
        socket.username = nombre;
        //avisa a todos quien entro
        io.emit('mensaje-sistema', `${socket.username} se ha unido al chat`);
    });

    //escuchar mensajes del chat y transmitirlos a todos
    socket.on('mensaje-chat', (msg) => {
        io.emit('mensaje-chat', {
            usuario: socket.username,
            mensaje: msg,
            hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    //escuchar cuando un usuario se desconecta
    socket.on('disconnect', () => {
        if (socket.username) {
            io.emit('mensaje-sistema', `${socket.username} ha salido del chat`);
        }
    });

});
// levantar el servidor en el puerto 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor ejecutan12 en http://localhost:${PORT}`);
});
