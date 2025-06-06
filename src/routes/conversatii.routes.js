const express = require('express');
const router = express.Router();
const pool = require('../utils/db');

// Adăugare conversație
router.post('/conversatii', async (req, res) => {
  const { expeditor, destinatar } = req.body;
  try {
    const result = await pool.query('SELECT adauga_conversatie($1, $2)', [expeditor, destinatar]);
    res.status(201).json({ conversatie_id: result.rows[0].adauga_conversatie });
  } catch (err) {
    res.status(500).json({ error: 'Eroare la creare conversație' });
  }
});

module.exports = router;