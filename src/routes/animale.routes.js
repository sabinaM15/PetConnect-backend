const express = require('express');
const router = express.Router();
const pool = require('../utils/db');
const multer = require('multer');
const upload = multer();


// Adăugare animal cu date medicale
router.post('/Animal', upload.single('poza'), async (req, res) => {
  // Pentru text: din req.body, pentru poza: din req.file
  const {
    posesor, nume, data_nasterii, sex, categorie, rasa, greutate,
    temperament, culoare, certificat_pedigree,
    vaccin, data_expirare_vaccin, deparazitare, data_expirare_deparazitare, sterilizat
  } = req.body;

  // Poza ca buffer (sau null dacă nu s-a trimis)
  const poza = req.file ? req.file.buffer : null;

  try {
    const result = await pool.query(
      'SELECT * FROM adauga_animal_cu_medical($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',
      [
        posesor, nume, data_nasterii, sex, categorie, rasa, greutate,
        temperament, culoare, certificat_pedigree,
        vaccin, data_expirare_vaccin, deparazitare, data_expirare_deparazitare, sterilizat,
        poza // adaugi poza ca ultim parametru
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
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
        'SELECT * FROM get_animal_by_id($1)',
        [animalId]
      );
      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Animal not found' });
      }
    } else if (userId) {
      // Căutare după user (toate animalele posesorului) - FOLOSESTE FUNCȚIA NOUĂ
      const result = await pool.query(
        'SELECT * FROM get_animale_by_user($1)',
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
    vaccin, data_expirare_vaccin, deparazitare, data_deparazitarii, sterilizat
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
        vaccin, data_expirare_vaccin, deparazitare, data_deparazitarii, sterilizat
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


router.post('/Animal/poza/:animalId', upload.single('poza'), async (req, res) => {
  const animalId = req.params.animalId;
  const pozaBuffer = req.file.buffer; // <-- poza ca buffer

  try {
    await pool.query(
      'UPDATE "Animale" SET poza = $1 WHERE animal_id = $2',
      [pozaBuffer, animalId]
    );
    res.status(200).json({ message: 'Poza salvată cu succes!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la salvarea pozei.' });
  }
});


module.exports = router;