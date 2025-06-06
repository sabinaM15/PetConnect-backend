const express = require('express');
const router = express.Router();
const pool = require('../utils/db');

// Adăugare mesaj
router.post('/mesaje', async (req, res) => {
  const { conversatie, expeditor, continut, tip_mesaj } = req.body;
  try {
    const result = await pool.query(
      'SELECT adauga_mesaj($1, $2, $3, $4)',
      [conversatie, expeditor, continut, tip_mesaj]
    );
    res.status(201).json({ mesaj_id: result.rows[0].adauga_mesaj });
  } catch (err) {
    res.status(500).json({ error: 'Eroare la trimitere mesaj' });
  }
});

// Vizualizare mesaje după utilizator
router.get('/mesaje/user/:userId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM get_mesaje_by_user($1)', [req.params.userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Eroare la preluare mesaje' });
  }
});

module.exports = router;