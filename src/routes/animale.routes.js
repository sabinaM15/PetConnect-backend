const express = require('express');
const router = express.Router();
const pool = require('../utils/db');

// Adăugare animal cu date medicale
router.post('/animale', async (req, res) => {
  const { posesor, nume, data_nasterii, sex, categorie, rasa, greutate, temperament, culoare, certificat_pedigree, vaccin, data_vaccinarii, deparazitare, data_deparazitarii, sterilizat } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT adauga_animal_cu_medical($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)',
      [posesor, nume, data_nasterii, sex, categorie, rasa, greutate, temperament, culoare, certificat_pedigree, vaccin, data_vaccinarii, deparazitare, data_deparazitarii, sterilizat]
    );
    res.status(201).json({ animal_id: result.rows[0].adauga_animal_cu_medical });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la adăugare animal' });
  }
});

// Vizualizare animale după utilizator
router.get('/Animale', async (req, res) => {
  try {
    const userId = req.query.user; // Extrage user din query (?user=2)
    
    // Interogare SQL directă (fără procedură stocată)
    const result = await pool.query(
      'SELECT * FROM public."Animale" WHERE posesor = $1',
      [userId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la preluarea animalelor' });
  }
});

module.exports = router;
