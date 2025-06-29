const express = require('express');
const router = express.Router();
const pool = require('../utils/db');

router.post('/Raspunsuri', async (req, res) => {
  const {
    intrebare_id,
    autorul_raspunsului,
    raspuns,
    data_raspuns
  } = req.body;

  try {
    await pool.query(
      'SELECT raspunde_la_intrebare($1, $2, $3, $4)',
      [intrebare_id, autorul_raspunsului, raspuns, data_raspuns]
    );
    res.status(201).json({ message: 'Răspuns adăugat cu succes!' });
  } catch (err) {
    console.error('Error adding answer:', err);
    res.status(500).json({ error: 'Eroare la adăugarea răspunsului.' });
  }
});

module.exports = router;