const express = require('express');
const router = express.Router();
const pool = require('../utils/db');

router.get('/Anunturi/imperechere', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const count = parseInt(req.query.count) || 10;
  const sort = req.query.sort || 'data_anuntului';

  try {
    const result = await pool.query(
      "SELECT * FROM get_anunturi_imperechere($1, $2, $3)", 
      [count, page, sort]
    );
    
    const anunturi = result.rows;
    const total = anunturi.length > 0 ? parseInt(anunturi[0].total) : 0;
    
    res.json({
      data: anunturi.map(anunt => {
        const { total, ...anuntData } = anunt;
        return anuntData;
      }),
      page: page,
      count: count,
      sort: sort,
      total: total
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post('/Anunturi/imperechere', async (req, res) => {
  const {
    animal,
    utilizator,
    descriere,
    locatie
  } = req.body;

  try {
    const result = await pool.query(
      'SELECT adauga_anunt_imperechere($1, $2, $3, $4) AS anunt_id',
      [animal, utilizator, descriere, locatie]
    );
    res.status(201).json({ anunt_id: result.rows[0].anunt_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la adăugarea anunțului.' });
  }
});

router.get("/Anunturi/socializare", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const count = parseInt(req.query.count) || 10;
  const sort = req.query.sort || 'data_anuntului';

  try {
    const result = await pool.query(
      "SELECT * FROM get_anunturi_socializare($1, $2, $3)", 
      [count, page, sort]
    );
    
    const anunturi = result.rows;
    const total = anunturi.length > 0 ? parseInt(anunturi[0].total) : 0;
    
    res.json({
      data: anunturi.map(anunt => {
        const { total, ...anuntData } = anunt;
        return anuntData;
      }),
      page: page,
      count: count,
      sort: sort,
      total: total
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


router.post('/Anunturi/socializare', async (req, res) => {
  const {
    titlu,
    tip, // 'individual' sau 'grup'
    data_anuntului,
    locatie,
    descriere,
    animal_id // poate fi null pentru grup
  } = req.body;

  try {
    const result = await pool.query(
      'SELECT adauga_anunt_socializare($1, $2, $3, $4, $5, $6)',
      [
        titlu,
        tip,
        data_anuntului,
        locatie,
        descriere,
        animal_id // trimite null dacă nu există
      ]
    );
    res.status(201).json({ anunt_id: result.rows[0].adauga_anunt_socializare });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la adăugarea anunțului.' });
  }
});

router.post('/Anunturi/socializare/participa', async (req, res) => {
  const { anunt_id, animal_id } = req.body;

  if (!anunt_id || !animal_id) {
    return res.status(400).json({ error: 'anunt_id și animal_id sunt obligatorii.' });
  }

  try {
    await pool.query(
      'SELECT participa_la_eveniment($1, $2)',
      [anunt_id, animal_id]
    );
    res.status(200).json({ message: 'Animalul a fost adăugat la participanți.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la adăugarea participantului.' });
  }
});

router.get("/Anunturi/suport", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const count = parseInt(req.query.count) || 10;
  const sort = req.query.sort || 'data_anuntului';

  try {
    const result = await pool.query(
      "SELECT * FROM get_anunturi_suport($1, $2, $3)", 
      [count, page, sort]
    );
    
    const anunturi = result.rows;
    const total = anunturi.length > 0 ? parseInt(anunturi[0].total) : 0;
    
    res.json({
      data: anunturi.map(anunt => {
        const { total, ...anuntData } = anunt;
        return anuntData;
      }),
      page: page,
      count: count,
      sort: sort,
      total: total
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


router.post('/Anunturi/suport', async (req, res) => {
  const {
    animal,
    locatie,
    motiv,
    remunerariu,
    tip_perioada,
    data_ora,
    descriere,
    utilizator
  } = req.body;


  try {
    const result = await pool.query(
      'SELECT adauga_anunt_suport($1, $2, $3, $4, $5, $6, $7, $8)',
      [animal, locatie, motiv, remunerariu, tip_perioada, data_ora, descriere, utilizator]
    );
    res.status(201).json({ anunt_id: result.rows[0].adauga_anunt_suport });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la adăugarea anunțului de suport.' });
  }
});



module.exports = router;