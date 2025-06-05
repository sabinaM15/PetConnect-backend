const express = require("express");
const router = express.Router();
const pool = require("../utils/db");
const multer = require("multer");
const upload = multer();


// PUT /api/Animal?id=Anm2
router.put('/Animal', async (req, res) => {
  console.log('Actualizare animal:', req.params.id, req.body);
  const animal_id = req.query.id || req.body.animal_id;
  const {
    data_nasterii,
    sex,
    categorie,
    rasa,
    greutate,
    temperament,
    culoare,
    certificat_pedigree,
    vaccin,
    data_expirare_vaccin,
    deparazitare,
    data_expirare_deparazitare,
    sterilizat
  } = req.body;

  try {
    // Validări
    const validTemperaments = ['calm', 'jucaus', 'agresiv', 'prietenos', 'timid', 'protector', 'curajos', 'energic', 'independent', 'altul'];
    
    if (temperament && Array.isArray(temperament)) {
      const invalidTemperaments = temperament.filter(t => !validTemperaments.includes(t));
      if (invalidTemperaments.length > 0) {
        return res.status(400).json({
          error: `Temperamente invalide: ${invalidTemperaments.join(', ')}`
        });
      }
    }

    // Apelarea procedurii stored
    const query = `
      SELECT update_animal_complete(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
    `;
    
    const values = [
      animal_id,
      data_nasterii ? new Date(data_nasterii) : null,
      sex || null,
      categorie || null,
      rasa || null,
      greutate || null,
      temperament || null,
      culoare || null,
      certificat_pedigree !== undefined ? certificat_pedigree : null,
      vaccin || null,
      data_expirare_vaccin ? data_expirare_vaccin : null,
      deparazitare || null,
      data_expirare_deparazitare ? data_expirare_deparazitare : null,
      sterilizat !== undefined ? sterilizat : null
    ];

    await pool.query(query, values);

    res.status(200).json({
      success: true,
      message: 'Toate datele animalului au fost actualizate cu succes',
      animal_id: animal_id
    });

  } catch (error) {
    console.error('Eroare la actualizarea completă a animalului:', error);
    res.status(500).json({
      error: 'Eroare la actualizarea animalului',
      details: error.message
    });
  }
});

// Adăugare animal cu date medicale
router.post("/Animal", upload.single("poza"), async (req, res) => {
  // Pentru text: din req.body, pentru poza: din req.file
  const {
    posesor,
    nume,
    data_nasterii,
    sex,
    categorie,
    rasa,
    greutate,
    temperament,
    culoare,
    certificat_pedigree,
    vaccin,
    data_expirare_vaccin,
    deparazitare,
    data_expirare_deparazitare,
    sterilizat,
  } = req.body;

  // Poza ca buffer (sau null dacă nu s-a trimis)
  const poza = req.file ? req.file.buffer : null;

  try {
    const result = await pool.query(
      "SELECT * FROM adauga_animal_cu_medical($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
      [
        posesor,
        nume,
        data_nasterii,
        sex,
        categorie,
        rasa,
        greutate,
        temperament,
        culoare,
        certificat_pedigree,
        vaccin,
        data_expirare_vaccin,
        deparazitare,
        data_expirare_deparazitare,
        sterilizat,
        poza, // adaugi poza ca ultim parametru
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});

// Vizualizare animale după utilizator/id
router.get("/Animal", async (req, res) => {
  console.log('Căutare animale:', req.query);
  const animalId = req.query.id;
  const userId = req.query.user;
  const page = parseInt(req.query.page) || 1;
  const count = parseInt(req.query.count) || 10;
  const sort = req.query.sort || 'data_nasterii';

  try {
    if (animalId) {
      // Căutare după id animal
      const result = await pool.query("SELECT * FROM get_animal_by_id($1)", [animalId]);
      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: "Animal not found" });
      }
    } else if (userId) {
      // Căutare după user cu paginare simplă
      const result = await pool.query(
        "SELECT * FROM get_animale_by_user($1, $2, $3, $4)", 
        [userId, count, page, sort]
      );
      
      const animals = result.rows;
      const total = animals.length > 0 ? parseInt(animals[0].total) : 0;
      
      res.json({
        data: animals.map(animal => {
          const { total, ...animalData } = animal;
          return animalData;
        }),
        page: page,
        count: count,
        sort: sort,
        total: total
      });
    } else {
      res.status(400).json({ error: "Missing id or user parameter" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


router.post(
  "/Animal/poza/:animalId",
  upload.single("poza"),
  async (req, res) => {
    const animalId = req.params.animalId;
    const pozaBuffer = req.file.buffer; // <-- poza ca buffer

    try {
      await pool.query('UPDATE "Animale" SET poza = $1 WHERE animal_id = $2', [
        pozaBuffer,
        animalId,
      ]);
      res.status(200).json({ message: "Poza salvată cu succes!" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Eroare la salvarea pozei." });
    }
  }
);

module.exports = router;
