const express = require('express');
const router = express.Router();
const pool = require('../utils/db');

// Adăugare întrebare
router.post('/intrebari', async (req, res) => {
  const { utilizator, descriere } = req.body;
  try {
    const result = await pool.query('SELECT adauga_intrebare($1, $2)', [utilizator, descriere]);
    res.status(201).json({ intrebare_id: result.rows[0].adauga_intrebare });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la adăugare întrebare' });
  }
});

// Adăugare răspuns
router.post('/raspunsuri', async (req, res) => {
  const { intrebare, descriere } = req.body;
  try {
    const result = await pool.query('SELECT adauga_raspuns($1, $2)', [intrebare, descriere]);
    res.status(201).json({ raspuns_id: result.rows[0].adauga_raspuns });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la adăugare răspuns' });
  }
});

// Vizualizare întrebări după utilizator
router.get('/intrebari/user/:userId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM get_intrebari_by_user($1)', [req.params.userId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la preluare întrebări' });
  }
});

module.exports = router;