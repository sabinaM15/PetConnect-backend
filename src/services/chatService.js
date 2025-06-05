// src/services/chatService.js
const pool = require("../utils/db");
const { generateId } = require("../utils/helpers");

class ChatService {
  async getOrCreateConversation(user1Id, user2Id) {
    try {

      // Asigură-te că user1Id < user2Id pentru consistență în baza de date
      const [participant1, participant2] =
        user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];

      const selectQuery = `
        SELECT c.*, 
               u1.nume as participant1_nume, u1.mail as participant1_email,
               u2.nume as participant2_nume, u2.mail as participant2_email
        FROM "Conversatii" c
        JOIN "Utilizatori" u1 ON c.participant1_id = u1.utilizator_id
        JOIN "Utilizatori" u2 ON c.participant2_id = u2.utilizator_id
        WHERE c.participant1_id = $1 AND c.participant2_id = $2
      `;

      let result = await pool.query(selectQuery, [participant1, participant2]);

      if (result.rows.length === 0) {
        // Creează conversația nouă
        const conversatieId = generateId();
        const insertQuery = `
          INSERT INTO "Conversatii" (conversatie_id, participant1_id, participant2_id)
          VALUES ($1, $2, $3)
        `;
        await pool.query(insertQuery, [
          conversatieId,
          participant1,
          participant2,
        ]);

        // Obține conversația cu detaliile utilizatorilor
        result = await pool.query(selectQuery, [participant1, participant2]);
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Obține sau creează conversația între doi utilizatori
 async getUserConversations(userId, page = 1, limit = 10, sort = 'ultima_activitate') {
  try {
    const offset = (page - 1) * limit;
    
    // Validează coloana de sortare
    const validSortColumns = ['ultima_activitate', 'data_creare', 'data_ultimul_mesaj'];
    const sortColumn = validSortColumns.includes(sort) ? sort : 'ultima_activitate';
    
    const query = `
      SELECT c.*, 
             CASE 
               WHEN c.participant1_id = $1 THEN u2.nume 
               ELSE u1.nume 
             END as alt_participant_nume,
             CASE 
               WHEN c.participant1_id = $1 THEN u2.prenume 
               ELSE u1.prenume 
             END as alt_participant_prenume,
             CASE 
               WHEN c.participant1_id = $1 THEN u2.nume_utilizator 
               ELSE u1.nume_utilizator 
             END as alt_participant_nume_utilizator,
             CASE 
               WHEN c.participant1_id = $1 THEN u2.mail 
               ELSE u1.mail 
             END as alt_participant_mail,
             CASE 
               WHEN c.participant1_id = $1 THEN c.participant2_id 
               ELSE c.participant1_id 
             END as alt_participant_id,
             m.continut as ultimul_mesaj_text,
             m.tip_mesaj as ultimul_mesaj_tip,
             m.nume_fisier as ultimul_mesaj_fisier,
             m.data_trimitere as data_ultimul_mesaj,
             COALESCE(unread.count, 0) as mesaje_necitite,
             COUNT(*) OVER() as total_count
      FROM "Conversatii" c
      JOIN "Utilizatori" u1 ON c.participant1_id = u1.utilizator_id
      JOIN "Utilizatori" u2 ON c.participant2_id = u2.utilizator_id
      LEFT JOIN "Mesaje" m ON c.conversatie_id = m.conversatie_id 
        AND m.data_trimitere = (
          SELECT MAX(data_trimitere) 
          FROM "Mesaje" 
          WHERE conversatie_id = c.conversatie_id
        )
      LEFT JOIN (
        SELECT conversatie_id, COUNT(*) as count
        FROM "Mesaje"
        WHERE citit = false AND expeditor_id != $1
        GROUP BY conversatie_id
      ) unread ON c.conversatie_id = unread.conversatie_id
      WHERE c.participant1_id = $1 OR c.participant2_id = $1
      ORDER BY ${sortColumn} DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [userId, limit, offset]);
    
    const conversations = result.rows;
    const totalCount = conversations.length > 0 ? parseInt(conversations[0].total_count) : 0;
    
    return {
      data: conversations.map(conv => {
        const { total_count, ...convData } = conv;
        return convData;
      }),
      pagination: {
        page: page,
        limit: limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1
      }
    };
  } catch (error) {
    throw error;
  }
}


  // Salvează un mesaj text
  async saveTextMessage(conversatieId, expeditorId, continut) {
    try {
      const mesajId = generateId();
      const query = `
        INSERT INTO "Mesaje" (mesaj_id, conversatie_id, expeditor_id, continut, tip_mesaj)
        VALUES ($1, $2, $3, $4, 'text') 
        RETURNING *, 
          (SELECT nume FROM "Utilizatori" WHERE utilizator_id = $2) as expeditor_nume,
          (SELECT mail FROM "Utilizatori" WHERE utilizator_id = $2) as expeditor_mail
      `;

      const result = await pool.query(query, [
        mesajId,
        conversatieId,
        expeditorId,
        continut,
      ]);

      // Actualizează ultima activitate
      await this.updateConversationActivity(conversatieId);

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Salvează un mesaj cu fișier
  async saveFileMessage(conversatieId, expeditorId, fileInfo) {
    try {
      const mesajId = generateId();
      const query = `
        INSERT INTO "Mesaje" (mesaj_id, conversatie_id, expeditor_id, tip_mesaj, nume_fisier, cale_fisier, marime_fisier)
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING *,
          (SELECT nume FROM "Utilizatori" WHERE utilizator_id = $2) as expeditor_nume,
          (SELECT mail FROM "Utilizatori" WHERE utilizator_id = $2) as expeditor_mail
      `;

      const result = await pool.query(query, [
        mesajId,
        conversatieId,
        expeditorId,
        fileInfo.tip_mesaj,
        fileInfo.nume_fisier,
        fileInfo.cale_fisier,
        fileInfo.marime_fisier,
      ]);

      await this.updateConversationActivity(conversatieId);

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Obține mesajele unei conversații
  async getMessages(conversatieId, limit = 50, offset = 0) {
    try {
      const query = `
        SELECT m.*, 
               u.nume as expeditor_nume, 
               u.mail as expeditor_mail
        FROM "Mesaje" m
        JOIN "Utilizatori" u ON m.expeditor_id = u.utilizator_id
        WHERE m.conversatie_id = $1
        ORDER BY m.data_trimitere DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [conversatieId, limit, offset]);
      return result.rows.reverse(); // Inversează pentru ordine cronologică
    } catch (error) {
      throw error;
    }
  }

  // Obține conversațiile unui utilizator
  async getUserConversations(userId) {
    try {
      const query = `
        SELECT c.*, 
               CASE 
                 WHEN c.participant1_id = $1 THEN u2.nume 
                 ELSE u1.nume 
               END as alt_participant_nume,
               CASE 
                 WHEN c.participant1_id = $1 THEN u2.mail 
                 ELSE u1.mail 
               END as alt_participant_mail,
               CASE 
                 WHEN c.participant1_id = $1 THEN c.participant2_id 
                 ELSE c.participant1_id 
               END as alt_participant_id,
               m.continut as ultimul_mesaj_text,
               m.tip_mesaj as ultimul_mesaj_tip,
               m.nume_fisier as ultimul_mesaj_fisier,
               m.data_trimitere as data_ultimul_mesaj,
               COALESCE(unread.count, 0) as mesaje_necitite
        FROM "Conversatii" c
        JOIN "Utilizatori" u1 ON c.participant1_id = u1.utilizator_id
        JOIN "Utilizatori" u2 ON c.participant2_id = u2.utilizator_id
        LEFT JOIN "Mesaje" m ON c.conversatie_id = m.conversatie_id 
          AND m.data_trimitere = (
            SELECT MAX(data_trimitere) 
            FROM "Mesaje" 
            WHERE conversatie_id = c.conversatie_id
          )
        LEFT JOIN (
          SELECT conversatie_id, COUNT(*) as count
          FROM "Mesaje"
          WHERE citit = false AND expeditor_id != $1
          GROUP BY conversatie_id
        ) unread ON c.conversatie_id = unread.conversatie_id
        WHERE c.participant1_id = $1 OR c.participant2_id = $1
        ORDER BY c.ultima_activitate DESC
      `;

      const result = await pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Marchează mesajele ca citite
  async markMessagesAsRead(conversatieId, userId) {
    try {
      const query = `
        UPDATE "Mesaje" 
        SET citit = true 
        WHERE conversatie_id = $1 AND expeditor_id != $2 AND citit = false
        RETURNING mesaj_id
      `;

      const result = await pool.query(query, [conversatieId, userId]);
      return result.rows.length; // Returnează numărul de mesaje marcate
    } catch (error) {
      throw error;
    }
  }

  // Actualizează ultima activitate a conversației
  async updateConversationActivity(conversatieId) {
    try {
      const query = `
        UPDATE "Conversatii" 
        SET ultima_activitate = NOW() 
        WHERE conversatie_id = $1
      `;

      await pool.query(query, [conversatieId]);
    } catch (error) {
      throw error;
    }
  }

  // Verifică dacă utilizatorul face parte din conversație
  async isUserInConversation(conversatieId, userId) {
    try {
      const query = `
        SELECT 1 FROM "Conversatii" 
        WHERE conversatie_id = $1 AND (participant1_id = $2 OR participant2_id = $2)
      `;

      const result = await pool.query(query, [conversatieId, userId]);
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  // Șterge un mesaj (soft delete)
  async deleteMessage(mesajId, userId) {
    try {
      const query = `
        UPDATE "Mesaje" 
        SET continut = '[Mesaj șters]', nume_fisier = NULL, cale_fisier = NULL 
        WHERE mesaj_id = $1 AND expeditor_id = $2
        RETURNING *
      `;

      const result = await pool.query(query, [mesajId, userId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Obține statistici conversație
  async getConversationStats(conversatieId) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_mesaje,
          COUNT(*) FILTER (WHERE tip_mesaj = 'text') as mesaje_text,
          COUNT(*) FILTER (WHERE tip_mesaj = 'image') as mesaje_imagini,
          COUNT(*) FILTER (WHERE tip_mesaj = 'file') as mesaje_fisiere,
          MIN(data_trimitere) as primul_mesaj,
          MAX(data_trimitere) as ultimul_mesaj
        FROM "Mesaje"
        WHERE conversatie_id = $1
      `;

      const result = await pool.query(query, [conversatieId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // În chatService.js, actualizează metoda getUserConversations
  // În chatService.js, actualizează metoda getUserConversations
  async getUserConversations(userId) {
    try {
      const query = `
      SELECT c.*, 
             CASE 
               WHEN c.participant1_id = $1 THEN u2.nume 
               ELSE u1.nume 
             END as alt_participant_nume,
             CASE 
               WHEN c.participant1_id = $1 THEN u2.prenume 
               ELSE u1.prenume 
             END as alt_participant_prenume,
             CASE 
               WHEN c.participant1_id = $1 THEN u2.nume_utilizator 
               ELSE u1.nume_utilizator 
             END as alt_participant_nume_utilizator,
             CASE 
               WHEN c.participant1_id = $1 THEN u2.mail 
               ELSE u1.mail 
             END as alt_participant_email,
             CASE 
               WHEN c.participant1_id = $1 THEN c.participant2_id 
               ELSE c.participant1_id 
             END as alt_participant_id,
             m.continut as ultimul_mesaj_text,
             m.tip_mesaj as ultimul_mesaj_tip,
             m.nume_fisier as ultimul_mesaj_fisier,
             m.data_trimitere as data_ultimul_mesaj,
             COALESCE(unread.count, 0) as mesaje_necitite
      FROM "Conversatii" c
      JOIN "Utilizatori" u1 ON c.participant1_id = u1.utilizator_id
      JOIN "Utilizatori" u2 ON c.participant2_id = u2.utilizator_id
      LEFT JOIN "Mesaje" m ON c.conversatie_id = m.conversatie_id 
        AND m.data_trimitere = (
          SELECT MAX(data_trimitere) 
          FROM "Mesaje" 
          WHERE conversatie_id = c.conversatie_id
        )
      LEFT JOIN (
        SELECT conversatie_id, COUNT(*) as count
        FROM "Mesaje"
        WHERE citit = false AND expeditor_id != $1
        GROUP BY conversatie_id
      ) unread ON c.conversatie_id = unread.conversatie_id
      WHERE c.participant1_id = $1 OR c.participant2_id = $1
      ORDER BY c.ultima_activitate DESC
    `;

      const result = await pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Adaugă metoda getConversationDetails
  async getConversationDetails(conversatieId, currentUserId) {
    try {
      const query = `
      SELECT c.*, 
             CASE 
               WHEN c.participant1_id = $2 THEN u2.nume 
               ELSE u1.nume 
             END as alt_participant_nume,
             CASE 
               WHEN c.participant1_id = $2 THEN u2.prenume 
               ELSE u1.prenume 
             END as alt_participant_prenume,
             CASE 
               WHEN c.participant1_id = $2 THEN u2.nume_utilizator 
               ELSE u1.nume_utilizator 
             END as alt_participant_nume_utilizator,
             CASE 
               WHEN c.participant1_id = $2 THEN u2.mail 
               ELSE u1.mail 
             END as alt_participant_email,
             CASE 
               WHEN c.participant1_id = $2 THEN c.participant2_id 
               ELSE c.participant1_id 
             END as alt_participant_id
      FROM "Conversatii" c
      JOIN "Utilizatori" u1 ON c.participant1_id = u1.utilizator_id
      JOIN "Utilizatori" u2 ON c.participant2_id = u2.utilizator_id
      WHERE c.conversatie_id = $1
    `;

      const result = await pool.query(query, [conversatieId, currentUserId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Adaugă metoda getConversationDetails
  async getConversationDetails(conversatieId, currentUserId) {
    try {
      const query = `
      SELECT c.*, 
             CASE 
               WHEN c.participant1_id = $2 THEN u2.nume 
               ELSE u1.nume 
             END as alt_participant_nume,
             CASE 
               WHEN c.participant1_id = $2 THEN u2.prenume 
               ELSE u1.prenume 
             END as alt_participant_prenume,
             CASE 
               WHEN c.participant1_id = $2 THEN u2.nume_utilizator 
               ELSE u1.nume_utilizator 
             END as alt_participant_nume_utilizator,
             CASE 
               WHEN c.participant1_id = $2 THEN u2.mail 
               ELSE u1.mail 
             END as alt_participant_email,
             CASE 
               WHEN c.participant1_id = $2 THEN c.participant2_id 
               ELSE c.participant1_id 
             END as alt_participant_id
      FROM "Conversatii" c
      JOIN "Utilizatori" u1 ON c.participant1_id = u1.utilizator_id
      JOIN "Utilizatori" u2 ON c.participant2_id = u2.utilizator_id
      WHERE c.conversatie_id = $1
    `;

      const result = await pool.query(query, [conversatieId, currentUserId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new ChatService();
