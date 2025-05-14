const express = require('express');
const router = express.Router();
const pool = require('../utils/db');

// Adăugare anunț
router.post('/anunturi', async (req, res) => {
  const { titlu, descriere, categorie, locatie, animal, utilizator } = req.body;
  try {
    const result = await pool.query(
      'SELECT adauga_anunt($1, $2, $3, $4, $5, $6)',
      [titlu, descriere, categorie, locatie, animal, utilizator]
    );
    res.status(201).json({ anunt_id: result.rows[0].adauga_anunt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la creare anunț' });
  }
});

// Vizualizare anunțuri după categorie
router.get('/anunturi/categorie/:categorie', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM get_anunturi_by_categorie($1)', [req.params.categorie]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la preluare anunțuri' });
  }
});

module.exports = router;