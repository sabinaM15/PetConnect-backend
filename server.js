const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Importă toate rutele
const utilizatoriRoutes = require('./src/routes/utilizatori.routes');
const animaleRoutes = require('./src/routes/animale.routes');
const conversatiiRoutes = require('./src/routes/conversatii.routes');
const mesajeRoutes = require('./src/routes/mesaje.routes');
const intrebariRoutes = require('./src/routes/intrebari.routes');
const raspunsuriRoutes = require('./src/routes/raspunsuri.routes');
const anunturiRoutes = require('./src/routes/anunturi.routes');

// Configurează rutele
app.use('/api', utilizatoriRoutes);
app.use('/api', animaleRoutes);
app.use('/api', conversatiiRoutes);
app.use('/api', mesajeRoutes);
app.use('/api', intrebariRoutes);
app.use('/api', raspunsuriRoutes);
app.use('/api', anunturiRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serverul rulează pe portul ${PORT}`);
});
