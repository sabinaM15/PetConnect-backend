const express = require('express');
const router = express.Router();
const pool = require('../utils/db');

// Adăugare animal cu date medicale
router.post('/Animal', async (req, res) => {
  const {
    posesor, nume, data_nasterii, sex, categorie, rasa, greutate,
    temperament, culoare, certificat_pedigree,
    vaccin, data_vaccinarii, deparazitare, data_deparazitarii, sterilizat
  } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM adauga_animal_cu_medical($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',
      [
        posesor, nume, data_nasterii, sex, categorie, rasa, greutate,
        temperament, culoare, certificat_pedigree,
        vaccin, data_vaccinarii, deparazitare, data_deparazitarii, sterilizat
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la adăugare animal' });
  }
});

// Vizualizare animale după utilizator/id
router.get('/Animal', async (req, res) => {
  const animalId = req.query.id;
  const userId = req.query.user;

  try {
    if (animalId) {
      // Căutare după id animal
      const result = await pool.query(
        'SELECT * FROM get_animal_by_id_full($1)',
        [animalId]
      );
      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Animal not found' });
      }
    } else if (userId) {
      // Căutare după user (toate animalele posesorului)
      const result = await pool.query(
        'SELECT * FROM public."Animale" WHERE posesor = $1',
        [userId]
      );
      res.json(result.rows);
    } else {
      // Niciun parametru relevant
      res.status(400).json({ error: 'Missing id or user parameter' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/Animal?id=Anm2
router.put('/Animal', async (req, res) => {
  const animalId = req.query.id;
  const {
    posesor, nume, data_nasterii, sex, categorie, rasa, greutate,
    temperament, culoare, certificat_pedigree,
    vaccin, data_vaccinarii, deparazitare, data_deparazitarii, sterilizat
  } = req.body;

  if (!animalId) {
    return res.status(400).json({ error: 'Missing id parameter' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM update_animal_by_id_full($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',
      [
        animalId, posesor, nume, data_nasterii, sex, categorie, rasa, greutate,
        temperament, culoare, certificat_pedigree,
        vaccin, data_vaccinarii, deparazitare, data_deparazitarii, sterilizat
      ]
    );
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Animal not found or not updated' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;