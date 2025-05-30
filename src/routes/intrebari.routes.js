const express = require('express');
const router = express.Router();
const pool = require('../utils/db');


router.get('/Intrebari', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM get_intrebari_cu_raspunsuri()');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la preluare întrebări și răspunsuri' });
  }
});

router.post('/Intrebari', async (req, res) => {
  const {
    autorul_intrebarii,
    intrebare,
    data_intrebare,
    ora_intrebare
  } = req.body;

  try {
    // Apelează funcția care inserează întrebarea și returnează id-ul generat
    const result = await pool.query(
      'SELECT adauga_intrebare($1, $2, $3, $4) AS intrebare_id',
      [autorul_intrebarii, intrebare, data_intrebare, ora_intrebare]
    );
    // Trimite înapoi doar id-ul generat
    res.status(201).json({ intrebare_id: result.rows[0].intrebare_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la adăugarea întrebării.' });
  }
});



module.exports = router;