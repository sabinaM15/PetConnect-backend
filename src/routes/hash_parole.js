const bcrypt = require("bcrypt");
const pool = require("../utils/db");

(async () => {
  try {
    // 1. Selectează utilizatorii cu parola ne-hashuită
    const result = await pool.query(
      `SELECT utilizator_id, parola FROM "Utilizatori" WHERE LENGTH(parola) < 60 AND parola NOT LIKE '$2b$%'`
    );

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
  }
})();
