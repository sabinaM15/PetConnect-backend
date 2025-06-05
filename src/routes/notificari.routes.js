const express = require('express');
const router = express.Router();
const pool = require('../utils/db');


// Schimbă din GET în POST
router.post('/Medical/notifications', async (req, res) => {
  // Obține userId din body
  const { utilizator_id } = req.body;
  console.log('Obținere notificări medicale pentru utilizator:', utilizator_id);

  // Validare userId
  if (!utilizator_id) {
    return res.status(400).json({
      error: 'User ID este necesar',
      message: 'Vă rugăm să furnizați utilizator_id în body'
    });
  }

  try {
    const query = `SELECT * FROM check_expiring_medical_notifications($1)`;
    const result = await pool.query(query, [utilizator_id]);

    const notifications = result.rows.map(row => ({
      animal_id: row.animal_id,
      nume: row.nume,
      vaccin: row.vaccin,
      data_expirare_vaccin: row.data_expirare_vaccin,
      deparazitare: row.deparazitare,
      data_expirare_deparazitare: row.data_expirare_deparazitare,
      tip_expirare: row.tip_expirare,
      zile_ramase: row.zile_ramase
    }));

    res.status(200).json(notifications);

  } catch (error) {
    console.error('Eroare la obținerea notificărilor:', error);
    res.status(500).json({
      error: 'Eroare la obținerea notificărilor',
      details: error.message
    });
  }
});

module.exports = router;

