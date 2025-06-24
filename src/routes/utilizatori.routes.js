const express = require("express");
const router = express.Router();
const pool = require("../utils/db");
const multer = require("multer");
const upload = multer();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');


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
    const checkmail = await pool.query(
      'SELECT utilizator_id FROM "Utilizatori" WHERE mail = $1',
      [mail]
    );
    if (checkmail.rows.length > 0) {
      return res
        .status(409)
        .json({ error: "Există deja un cont cu acest mail." });
    }

    // 1. Hashuiește parola
    const saltRounds = 10;
    if (!parola) {
      throw new Error("Parola nu a fost furnizată!");
    }
    const hashedPassword = await bcrypt.hash(parola, saltRounds);

    // 2. Generează token de validare mail
    const mailToken = crypto.randomBytes(32).toString("hex");

    // 3. Salvează utilizatorul în baza de date (inclusiv tokenul și mail_validat=false)
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

// resetare parola
router.post("/Utilizatori/forgot-password", async (req, res) => {
  const { mail } = req.body;
  // Caută utilizatorul după email
  const userResult = await pool.query(
    'SELECT utilizator_id FROM "Utilizatori" WHERE mail = $1',
    [mail]
  );

  if (userResult.rows.length === 0) {
    // Emailul nu există
    return res.status(404).json({
      error: "Nu există un utilizator cu acest email."
    });
  }

  // Dacă există, continuă cu generarea tokenului și trimiterea emailului
  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 3600 * 1000); // 1 oră
  await pool.query(
    'UPDATE "Utilizatori" SET reset_token = $1, reset_token_expiry = $2 WHERE utilizator_id = $3',
    [token, expiry, userResult.rows[0].utilizator_id]
  );
  // Trimite emailul
  const resetLink = `http://localhost:3000/resetare-parola.html?token=${token}`;
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "petconnect17@gmail.com",
      pass: "sfuu cxub tfha zrvv",
    },
  });
  await transporter.sendMail({
    from: '"Echipa Aplicatie" <petconnect17@gmail.com>',
    to: mail,
    subject: "Resetare parolă",
    html: `
      <h3>Resetare parolă</h3>
      <p>Apasă pe linkul de mai jos pentru a-ți reseta parola:</p>
      <a href="${resetLink}">Resetează parola</a>
      <p>Linkul este valabil 1 oră.</p>
    `,
  });

  // Răspuns de confirmare dacă emailul există
  res.json({
    message:
      "Email dumneavoastra a fost identificat si veti primi un email de resetare a parolei.",
  });
});


router.get("/Utilizatori/resetare-parola", (req, res) => {
  res.sendFile(path.join(__dirname, "public/resetare-parola.html"));
});

// schimbarea efectiva
router.post("/Utilizatori/resetare-parola", async (req, res) => {
  const { token, newPassword } = req.body;
  // Găsește utilizatorul cu token valid și neexpirat (dacă ai și expirare)
  const userResult = await pool.query(
    'SELECT utilizator_id FROM "Utilizatori" WHERE reset_token = $1',
    [token]
  );
  if (userResult.rows.length === 0) {
    return res.status(400).json({ error: "Token invalid sau expirat." });
  }
  const hashed = await bcrypt.hash(newPassword, 10);
  await pool.query(
    'UPDATE "Utilizatori" SET parola = $1, reset_token = NULL WHERE utilizator_id = $2',
    [hashed, userResult.rows[0].utilizator_id]
  );
  res.json({ message: "Parola a fost resetată cu succes. Puteti reveni in aplicatie pentru a continua autentificarea" });
});

// login
router.post("/login", async (req, res) => {
  const { mail, parola } = req.body;
  try {
    // 1. Caută utilizatorul după email
    const result = await pool.query(
      'SELECT * FROM "Utilizatori" WHERE mail = $1',
      [mail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Username sau parolă incorectă" });
    }

    const user = result.rows[0];

    // 2. Verifică dacă emailul este validat
    if (!user.email_validat) {
      return res
        .status(403)
        .json({
          error: "Emailul nu a fost validat. Te rugăm să îți verifici emailul.",
        });
    }

    // 3. Verifică parola
    const passwordMatch = await bcrypt.compare(parola, user.parola);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Username sau parolă incorectă" });
    }

    const token = jwt.sign(
      {
        utilizator_id: user.utilizator_id,
        email: user.mail,
        nume: user.nume,
        prenume: user.prenume,
        tip_profil: user.tip_profil
      },
      process.env.JWT_SECRET, // Asigură-te că ai JWT_SECRET în .env
      { expiresIn: '24h' }
    );

    // 5. Elimină parola și returnează user cu token
    delete user.parola;
    
    // RETURNEAZĂ USER-UL CU TOKEN-UL ADĂUGAT
    res.json({
      ...user,      // Toate datele utilizatorului existente
      token: token  // ADAUGĂ TOKEN-UL AICI
    });

  } catch (err) {
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
    res.status(500).json({ error: "Eroare la preluarea animalelor" });
  }
});


router.get('/Utilizatori', authMiddleware, async (req, res) => {
  try {
    const query = `
      SELECT utilizator_id, nume, prenume, mail, tip_profil, email_validat
      FROM "Utilizatori"
      WHERE email_validat = true
      ORDER BY nume, prenume
    `;
    
    const result = await pool.query(query);
    
    const users = result.rows.map(user => ({
      utilizator_id: user.utilizator_id,
      nume: user.nume,
      prenume: user.prenume,
      mail: user.mail,
      tip_profil: user.tip_profil
    }));
    
    res.json({
      success: true,
      data: users,
      count: users.length
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Eroare la obținerea utilizatorilor',
      details: error.message
    });
  }
});


module.exports = router;
