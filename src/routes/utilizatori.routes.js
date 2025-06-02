const express = require("express");
const router = express.Router();
const pool = require("../utils/db");
const multer = require("multer");
const upload = multer();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

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
    res.status(500).json({
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
    //verifica daca mail nu exista deja in baza de date
    const checkEmail = await pool.query(
      'SELECT utilizator_id FROM "Utilizatori" WHERE mail = $1',
      [mail]
    );
    if (checkEmail.rows.length > 0) {
      return res
        .status(409)
        .json({ error: "Există deja un cont cu acest email." });
    }

    // 1. Hashuiește parola
    const saltRounds = 10;
    if (!parola) {
      throw new Error("Parola nu a fost furnizată!");
    }
    const hashedPassword = await bcrypt.hash(parola, saltRounds);

    // 2. Generează token de validare email
    const emailToken = crypto.randomBytes(32).toString("hex");

    // 3. Salvează utilizatorul în baza de date (inclusiv tokenul și email_validat=false)
    const result = await pool.query(
      `INSERT INTO "Utilizatori"
        (nume, prenume, mail, telefon, nume_utilizator, parola, tip_profil, email_validat, email_validation_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7, false, $8)
       RETURNING utilizator_id`,
      [
        nume,
        prenume,
        mail,
        telefon,
        nume_utilizator,
        hashedPassword,
        tip_profil,
        emailToken,
      ]
    );

    const utilizator_id = result.rows[0].utilizator_id;

    // 4. Trimite emailul de validare
    const validationLink = `http://localhost:3000/api/Utilizatori/validare-email?token=${emailToken}`;
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "petconnect17@gmail.com",
        pass: "sfuu cxub tfha zrvv", // Folosește App Password!
      },
    });
    await transporter.sendMail({
      from: '"Echipa Aplicatie" <petconnect17@gmail.com>',
      to: mail,
      subject: "Validare email cont",
      html: `
        <h3>Bine ai venit!</h3>
        <p>Te rugăm să îți validezi adresa de email apăsând pe linkul de mai jos:</p>
        <a href="${validationLink}">Validează emailul</a>
        <p>Dacă nu ai cerut acest cont, ignoră acest mesaj.</p>
      `,
    });

    // 5. Trimite răspuns către frontend
    res.status(201).json({
      message:
        "Utilizator înregistrat cu succes! Verifică emailul pentru validare.",
      utilizator_id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare la înregistrare." });
  }
});

router.get("/Utilizatori/validare-email", async (req, res) => {
  const { token } = req.query;
  const result = await pool.query(
    'SELECT utilizator_id FROM "Utilizatori" WHERE email_validation_token = $1',
    [token]
  );
  if (result.rows.length === 0) {
    return res.send('<h2 style="color:red">Token invalid sau expirat.</h2>');
  }
  await pool.query(
    'UPDATE "Utilizatori" SET email_validat = true, email_validation_token = NULL WHERE utilizator_id = $1',
    [result.rows[0].utilizator_id]
  );
  res.send(
    '<h2 style="color:green">Email validat cu succes! Acum poți folosi aplicația.</h2>'
  );
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

    // 2. Verifică dacă emailul este validat
    if (!user.email_validat) {
      return res.status(403).json({ error: "Emailul nu a fost validat. Te rugăm să îți verifici emailul." });
    }

    // 3. Verifică parola
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
