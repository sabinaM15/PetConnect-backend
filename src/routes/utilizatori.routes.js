const express = require("express");
const router = express.Router();
const pool = require("../utils/db");
const multer = require("multer");
const upload = multer();
const bcrypt = require("bcrypt");

router.get("/utilizatori/nehashuite", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM get_utilizatori_parola_nehashuita()"
    );
    res.json(result.rows); // primești [{ utilizator_id: ..., parola: ... }, ...]
    for (const user of result.rows) {
      const { utilizator_id, parola } = user;
      // 2. Hashuiește parola
      const hashed = await bcrypt.hash(parola, 10);

      // 3. Updatează parola în baza de date
      await pool.query(
        `UPDATE "Utilizatori" SET parola = $1 WHERE utilizator_id = $2`,
        [hashed, utilizator_id]
      );
    }
    await pool.end();
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({
        error: "Eroare la preluarea utilizatorilor cu parole ne-hashuite.",
      });
  }
});

router.post("/Utilizatori/inregistrare", async (req, res) => {
  const {
    nume,
    prenume,
    mail,
    telefon,
    nume_utilizator,
    parola, // parola în clar primită din frontend
    tip_profil,
  } = req.body;

  try {
    // 1. Hashuiește parola
    const bcrypt = require("bcrypt");
    const saltRounds = 10;
    if (!parola) {
      throw new Error("Parola nu a fost furnizată!");
    }

    const hashedPassword = await bcrypt.hash(parola, saltRounds);

    // 2. Apelează procedura cu parola hashuită și preia utilizator_id
    const result = await pool.query(
      "SELECT inregistreaza_utilizator($1,$2,$3,$4,$5,$6,$7) AS utilizator_id",
      [
        nume,
        prenume,
        mail,
        telefon,
        nume_utilizator,
        hashedPassword, // parola hashuită!
        tip_profil,
      ]
    );

    // 3. Trimite utilizator_id în răspuns
    res.status(201).json({
      message: "Utilizator înregistrat cu succes!",
      utilizator_id: result.rows[0].utilizator_id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare la înregistrare." });
  }
});

// login
router.post("/login", async (req, res) => {
  const { nume_utilizator, parola } = req.body;
  try {
    // 1. Caută utilizatorul după nume_utilizator
    const result = await pool.query(
      'SELECT * FROM "Utilizatori" WHERE nume_utilizator = $1',
      [nume_utilizator]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Username sau parolă incorectă" });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(parola, user.parola);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Username sau parolă incorectă" });
    }

    delete user.parola;
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

router.get("/Utilizatori/:id", async (req, res) => {
  const utilizatorId = req.params.id;

  try {
    const result = await pool.query("SELECT * FROM get_utilizator_by_id($1)", [
      utilizatorId,
    ]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: "Utilizatorul nu a fost găsit." });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare la preluarea utilizatorului." });
  }
});

// Update utilizator
router.put("/Utilizatori", upload.single("poza"), async (req, res) => {
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
    tip_profil,
  } = req.body;

  // poza poate fi null dacă nu se trimite
  const poza = req.file ? req.file.buffer : null;

  try {
    const result = await pool.query(
      "SELECT * FROM update_utilizator($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
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
        poza, // noul parametru pentru poza
      ]
    );
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({
        error: "Utilizatorul nu a fost găsit sau nu s-a actualizat nimic.",
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare la actualizare utilizator." });
  }
});

// listare animale dupa utilizator
router.get("/Animale/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    const result = await pool.query("SELECT * FROM get_animale_by_user($1)", [
      userId,
    ]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare la preluarea animalelor" });
  }
});

module.exports = router;
