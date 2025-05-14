const express = require('express');
const router = express.Router();
const pool = require('../utils/db');

// Adăugare utilizator
router.post('/utilizatori', async (req, res) => {
  const { nume, prenume, mail, telefon, nume_utilizator, data_nasterii, sex, parola, tip_profil } = req.body;
  try {
    await pool.query('SELECT adauga_utilizator($1, $2, $3, $4, $5, $6, $7, $8, $9)', [
      nume, prenume, mail, telefon, nume_utilizator, data_nasterii, sex, parola, tip_profil
    ]);
    res.status(201).json({ message: 'Utilizator creat cu succes' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la creare utilizator' });
  }
});

module.exports = router;