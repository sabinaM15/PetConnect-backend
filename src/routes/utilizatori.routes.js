const express = require('express');
const router = express.Router();
const pool = require('../utils/db');
const multer = require('multer');
const upload = multer();


// Adăugare utilizator
// router.post('/utilizatori', async (req, res) => {
//   const { nume, prenume, mail, telefon, nume_utilizator, data_nasterii, sex, parola, tip_profil } = req.body;
//   try {
//     await pool.query('SELECT adauga_utilizator($1, $2, $3, $4, $5, $6, $7, $8, $9)', [
//       nume, prenume, mail, telefon, nume_utilizator, data_nasterii, sex, parola, tip_profil
//     ]);
//     res.status(201).json({ message: 'Utilizator creat cu succes' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Eroare la creare utilizator' });
//   }
// });


// login
router.post('/login', async (req, res) => {
  const { nume_utilizator, parola } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM login_utilizator($1, $2)',
      [nume_utilizator, parola]
    );
    console.log('Login result:', result.rows);
    if (result.rows.length > 0) {
      // Găsit, returnează toate datele utilizatorului
      res.json(result.rows[0]);
    } else {
      // Nu există utilizatorul sau parola e greșită
      res.status(401).json({ error: 'Username sau parolă incorectă' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Eroare server' });
  }
});


router.get('/Utilizatori/:id', async (req, res) => {
  const utilizatorId = req.params.id;

  try {
    const result = await pool.query(
      'SELECT * FROM get_utilizator_by_id($1)',
      [utilizatorId]
    );
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Utilizatorul nu a fost găsit.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la preluarea utilizatorului.' });
  }
});

// Update utilizator
router.put('/Utilizatori', upload.single('poza'), async (req, res) => {
  // id-ul poate veni din query sau body
  const utilizator_id = req.query.id || req.body.utilizator_id;
  const {
    nume,
    prenume,
    mail,
    telefon,
    nume_utilizator,
    data_nasterii,
    sex,
    parola,
    tip_profil
  } = req.body;

  // poza poate fi null dacă nu se trimite
  const poza = req.file ? req.file.buffer : null;

  try {
    const result = await pool.query(
      'SELECT * FROM update_utilizator($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [
        utilizator_id,
        nume,
        prenume,
        mail,
        telefon,
        nume_utilizator,
        data_nasterii,
        sex,
        parola,
        tip_profil,
        poza // noul parametru pentru poza
      ]
    );
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Utilizatorul nu a fost găsit sau nu s-a actualizat nimic.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la actualizare utilizator.' });
  }
});



// listare animale dupa utilizator
router.get('/Animale/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const result = await pool.query('SELECT * FROM get_animale_by_user($1)', [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la preluarea animalelor' });
  }
});


module.exports = router;