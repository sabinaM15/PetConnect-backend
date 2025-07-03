const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const server = http.createServer(app);

require('dotenv').config();

console.log('Server starting...');
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configurează Socket.IO
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:8100", 
      "http://localhost:8101", 
      "http://localhost:4200",
      "capacitor://localhost",
      "ionic://localhost",
      "http://localhost",
      "https://localhost",
      "http://192.168.0.109:8100",
      "http://192.168.0.109:8101",
      "http://192.168.0.109:4200",
      "http://172.20.10.11:8100",
      "http://172.20.10.11:8101",
      "http://172.20.10.11:4200",],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// CORS configuration for Capacitor apps
const corsOptions = {
  origin: [
    "http://localhost:8100", 
    "http://localhost:8101",
    "http://localhost:4200",
    "capacitor://localhost",
    "ionic://localhost", 
    "http://localhost",
    "https://localhost",
      "http://192.168.0.109:8100",
      "http://192.168.0.109:8101",
      "http://192.168.0.109:4200",
      "http://172.20.10.11:8100",
      "http://172.20.10.11:8101",
      "http://172.20.10.11:4200",],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// CORS middleware for Capacitor support
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    "http://localhost:8100", 
    "http://localhost:8101", 
    "http://localhost:4200",
    "capacitor://localhost",
    "ionic://localhost",
    "http://localhost",
    "https://localhost",
    "http://192.168.0.109:8100",
    "http://192.168.0.109:8101",
    "http://192.168.0.109:4200",
    "http://172.20.10.11:8100",
    "http://172.20.10.11:8101",
    "http://172.20.10.11:4200",];
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // Allow capacitor origins even if not exactly matched
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Răspunde la preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

app.use(express.json());

// Restul codului tău rămâne la fel...
// Importă toate rutele
const utilizatoriRoutes = require('./src/routes/utilizatori.routes');
const animaleRoutes = require('./src/routes/animale.routes');
const conversatiiRoutes = require('./src/routes/conversatii.routes');
const mesajeRoutes = require('./src/routes/mesaje.routes');
const intrebariRoutes = require('./src/routes/intrebari.routes');
const raspunsuriRoutes = require('./src/routes/raspunsuri.routes');
const anunturiRoutes = require('./src/routes/anunturi.routes');
const notificariRoutes = require('./src/routes/notificari.routes');
const chatRoutes = require('./src/routes/chat.routes');
const path = require('path');

// Configurează rutele
app.use('/api', utilizatoriRoutes);
app.use('/api', animaleRoutes);
app.use('/api', conversatiiRoutes);
app.use('/api', mesajeRoutes);
app.use('/api', intrebariRoutes);
app.use('/api', raspunsuriRoutes);
app.use('/api', anunturiRoutes);
app.use('/api', notificariRoutes);
app.use('/api/chat', chatRoutes);

// Servește fișierele statice
app.use(express.static(path.join(__dirname, 'public')));

// Middleware pentru autentificare Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.utilizator_id;
    socket.nume_utilizator = decoded.mail;
    socket.userName = decoded.nume || decoded.mail;
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Stocare pentru utilizatorii conectați
const connectedUsers = new Map();

// Importă serviciul chat
const chatService = require('./src/services/chatService');
const { Server } = require('https');

// Gestionarea conexiunilor Socket.IO
io.on('connection', (socket) => {
    // console.log('User connected:', socket.id);
  connectedUsers.set(socket.userId, {
    socketId: socket.id,
    userId: socket.userId,
    mail: socket.nume_utilizator,
    name: socket.userName,
    connectedAt: new Date()
  });
  
  // Notifică alți utilizatori că acest user este online
  socket.broadcast.emit('user_online', {
    userId: socket.userId,
    mail: socket.nume_utilizator,
    name: socket.userName
  });
  
  // Utilizatorul se alătură camerei personale
  socket.join(`user_${socket.userId}`);
  
  // Gestionarea trimiterii mesajelor TEXT
  socket.on('send_message', async (data) => {
    try {
      if (!data.conversatie_id || !data.continut?.trim()) {
        socket.emit('error', { message: 'Date invalide pentru mesaj' });
        return;
      }
      
      // Verifică dacă utilizatorul face parte din conversație
      const isInConversation = await chatService.isUserInConversation(data.conversatie_id, socket.userId);
      if (!isInConversation) {
        socket.emit('error', { message: 'Nu aveți acces la această conversație' });
        return;
      }
      
      // Salvează mesajul text
      const mesaj = await chatService.saveTextMessage(
        data.conversatie_id,
        socket.userId,
        data.continut.trim()
      );
      
      // Trimite mesajul către toți participanții conversației
      io.to(`conversation_${data.conversatie_id}`).emit('new_message', mesaj);
    } catch (error) {
      socket.emit('error', { message: 'Eroare la trimiterea mesajului' });
    }
  });
  
  // Alăturarea la o conversație
  socket.on('join_conversation', async (conversatieId) => {
    try {
      // Verifică dacă utilizatorul face parte din conversație
      const isInConversation = await chatService.isUserInConversation(conversatieId, socket.userId);
      if (!isInConversation) {
        socket.emit('error', { message: 'Nu aveți acces la această conversație' });
        return;
      }
      
      socket.join(`conversation_${conversatieId}`);
      
      // Notifică alți participanți că utilizatorul a intrat în conversație
      socket.to(`conversation_${conversatieId}`).emit('user_joined_conversation', {
        userId: socket.userId,
        userName: socket.userName,
        conversatieId: conversatieId
      });
      
    } catch (error) {
      socket.emit('error', { message: 'Eroare la alăturarea în conversație' });
    }
  });
  
  // Părăsirea unei conversații
  socket.on('leave_conversation', (conversatieId) => {
    socket.leave(`conversation_${conversatieId}`);
    
    // Notifică alți participanți că utilizatorul a părăsit conversația
    socket.to(`conversation_${conversatieId}`).emit('user_left_conversation', {
      userId: socket.userId,
      userName: socket.userName,
      conversatieId: conversatieId
    });
  });
  
  // Marcarea mesajelor ca citite
  socket.on('mark_as_read', async (data) => {
    try {
      const markedCount = await chatService.markMessagesAsRead(data.conversatie_id, socket.userId);
      
      // Notifică expeditorii că mesajele au fost citite
      socket.to(`conversation_${data.conversatie_id}`).emit('messages_read', {
        conversatie_id: data.conversatie_id,
        user_id: socket.userId,
        user_name: socket.userName,
        read_at: new Date(),
        marked_count: markedCount
      });      
    } catch (error) {
      socket.emit('error', { message: 'Eroare la marcarea mesajelor ca citite' });
    }
  });
  
  // Indicator de typing
  socket.on('typing_start', (data) => {
    socket.to(`conversation_${data.conversatie_id}`).emit('user_typing', {
      userId: socket.userId,
      userName: socket.userName,
      conversatie_id: data.conversatie_id,
      isTyping: true
    });
  });
  
  socket.on('typing_stop', (data) => {
    socket.to(`conversation_${data.conversatie_id}`).emit('user_typing', {
      userId: socket.userId,
      userName: socket.userName,
      conversatie_id: data.conversatie_id,
      isTyping: false
    });
  });
  
  // Gestionarea deconectării
  socket.on('disconnect', (reason) => {
    
    // Elimină utilizatorul din lista celor conectați
    connectedUsers.delete(socket.userId);
    
    // Notifică alți utilizatori că acest user este offline
    socket.broadcast.emit('user_offline', {
      userId: socket.userId,
      mail: socket.nume_utilizator,
      name: socket.userName,
      disconnectedAt: new Date()
    });
  });
  
  // Gestionarea erorilor
  socket.on('error', (error) => {
  });
});

// Endpoint pentru a obține utilizatorii online
app.get('/api/chat/online-users', (req, res) => {
  const onlineUsers = Array.from(connectedUsers.values()).map(user => ({
    userId: user.userId,
    mail: user.mail,
    name: user.name,
    connectedAt: user.connectedAt
  }));
  
  res.json({
    success: true,
    data: onlineUsers,
    count: onlineUsers.length
  });
});

// Fă instanța io disponibilă în alte module
app.set('io', io);

// Middleware global pentru gestionarea erorilor
app.use((error, req, res, next) => {
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Route pentru 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: 'Route not found'
  });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Access from other devices using IP:', '192.168.12.138:3000');
});

// Export pentru utilizare în alte module
module.exports = { app, server, io };
