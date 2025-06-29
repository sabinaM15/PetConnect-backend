const express = require('express');
const router = express.Router();
const pool = require('../utils/db');

router.get("/Intrebari", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const count = parseInt(req.query.count) || 10;
  const sort = req.query.sort || 'data_intrebare';

  try {
    const result = await pool.query(
      "SELECT * FROM get_intrebari_cu_raspunsuri($1, $2)", 
      [count, page]
    );
    
    const intrebari = result.rows;
    const total = intrebari.length > 0 ? parseInt(intrebari[0].total) : 0;
    res.json({
      data: intrebari.map(intrebare => {
        const { total, ...intrebareData } = intrebare;
        return intrebareData;
      }),
      page: page,
      count: count,
      sort: sort,
      total: total
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


router.post('/Intrebari', async (req, res) => {
  const {
    autorul_intrebarii,
    intrebare,
    data_intrebare,
    ora_intrebare
  } = req.body;

  try {
    // Apelează funcția care inserează întrebarea și returnează id-ul generat
    const result = await pool.query(
      'SELECT adauga_intrebare($1, $2, $3, $4) AS intrebare_id',
      [autorul_intrebarii, intrebare, data_intrebare, ora_intrebare]
    );
    // Trimite înapoi doar id-ul generat
    res.status(201).json({ intrebare_id: result.rows[0].intrebare_id });
  } catch (err) {
    res.status(500).json({ error: 'Eroare la adăugarea întrebării.' });
  }
});



module.exports = router;