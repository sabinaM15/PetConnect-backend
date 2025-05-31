const express = require('express');
const router = express.Router();
const pool = require('../utils/db');

router.get('/Anunturi/imperechere', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM get_anunturi_imperechere()');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la preluare anunțuri.' });
  }
});

router.post('/Anunturi/imperechere', async (req, res) => {
  const {
    animal,
    utilizator,
    descriere,
    locatie
  } = req.body;

  try {
    const result = await pool.query(
      'SELECT adauga_anunt_imperechere($1, $2, $3, $4) AS anunt_id',
      [animal, utilizator, descriere, locatie]
    );
    res.status(201).json({ anunt_id: result.rows[0].anunt_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la adăugarea anunțului.' });
  }
});

router.get('/Anunturi/socializare', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM get_anunturi_socializare()');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la preluare anunțuri de socializare.' });
  }
});


module.exports = router;