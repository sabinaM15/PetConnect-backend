const express = require("express");
const router = express.Router();
const chatService = require("../services/chatService");
const authMiddleware = require("../middleware/auth");
const { upload, handleUploadError } = require("../middleware/upload");
const { isImageFile } = require("../utils/helpers");
const path = require("path");

// Middleware pentru toate rutele
router.use(authMiddleware);

// Obține conversațiile utilizatorului
router.get("/conversations", async (req, res) => {
  try {  
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'ultima_activitate';
    
    const result = await chatService.getUserConversations(
      req.user.utilizator_id,
      page,
      limit,
      sort
    );
    
    // VERIFICĂ STRUCTURA ÎNAINTE DE A ACCESA PROPRIETĂȚILE
    if (!result || typeof result !== 'object') {
      return res.status(500).json({
        success: false,
        error: "Invalid response from getUserConversations"
      });
    }
    
    // Verifică dacă result.data există
    const conversations = result.data || result; // Fallback la result dacă data nu există
    
    res.json({
      success: true,
      data: Array.isArray(conversations) ? conversations : [],
      count: Array.isArray(conversations) ? conversations.length : 0,
      page: page,
      limit: limit,
      sort: sort,
      total: result.pagination?.total || (Array.isArray(conversations) ? conversations.length : 0)
    });
  } catch (error) {
    console.error("Error getting conversations:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

router.get("/conversations/:id", authMiddleware, async (req, res) => {
  try {
    const conversatieId = req.params.id;

    const isInConversation = await chatService.isUserInConversation(
      conversatieId,
      req.user.utilizator_id
    );
    if (!isInConversation) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Nu aveți acces la această conversație",
      });
    }

    const conversation = await chatService.getConversationDetails(
      conversatieId,
      req.user.utilizator_id
    );

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error("Error getting conversation details:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Obține mesajele unei conversații
router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const conversatieId = req.params.id;
    // Verifică dacă utilizatorul face parte din conversație
    const isInConversation = await chatService.isUserInConversation(
      conversatieId,
      req.user.utilizator_id
    );
    if (!isInConversation) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Nu aveți acces la această conversație",
      });
    }

    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const messages = await chatService.getMessages(
      conversatieId,
      parseInt(limit),
      offset
    );

    // Adaugă URL-urile pentru fișiere
    const messagesWithUrls = messages.map((msg) => ({
      ...msg,
      file_url: msg.cale_fisier ? `/${msg.cale_fisier}` : null,
    }));

    res.json({
      success: true,
      data: messagesWithUrls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        count: messages.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Creează o conversație nouă sau obține una existentă
router.post("/conversations", async (req, res) => {
  try {
    const { participant_id } = req.body;

    if (!participant_id) {
      return res.status(400).json({
        success: false,
        error: "Bad request",
        message: "participant_id este necesar",
      });
    }

    if (participant_id === req.user.utilizator_id) {
      return res.status(400).json({
        success: false,
        error: "Bad request",
        message: "Nu puteți crea o conversație cu dumneavoastră",
      });
    }

    const conversation = await chatService.getOrCreateConversation(
      req.user.utilizator_id,
      participant_id
    );

    res.json({
      success: true,
      data: conversation,
      message: "Conversație creată/găsită cu succes",
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Upload fișier în conversație
router.post(
  "/conversations/:id/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      const conversatieId = req.params.id;

      // Verifică dacă utilizatorul face parte din conversație
      const isInConversation = await chatService.isUserInConversation(
        conversatieId,
        req.user.utilizator_id
      );
      if (!isInConversation) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "Nu aveți acces la această conversație",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Bad request",
          message: "Nu a fost încărcat niciun fișier",
        });
      }

      // Determină tipul mesajului
      const tipMesaj = isImageFile(req.file.mimetype) ? "image" : "file";

      // Construiește calea relativă pentru frontend
      const relativePath = req.file.path.replace("public/", "");

      const fileInfo = {
        tip_mesaj: tipMesaj,
        nume_fisier: req.file.originalname,
        cale_fisier: relativePath,
        marime_fisier: req.file.size,
      };

      const mesaj = await chatService.saveFileMessage(
        conversatieId,
        req.user.utilizator_id,
        fileInfo
      );

      // Trimite mesajul prin Socket.IO
      const io = req.app.get("io");
      if (io) {
        io.to(`conversation_${conversatieId}`).emit("new_message", {
          ...mesaj,
          file_url: `/${relativePath}`,
        });
      }

      res.json({
        success: true,
        data: {
          ...mesaj,
          file_url: `/${relativePath}`,
        },
        message: "Fișier încărcat cu succes",
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error.message,
      });
    }
  }
);

// Marchează mesajele ca citite
router.put("/conversations/:id/read", async (req, res) => {
  try {
    const conversatieId = req.params.id;

    const isInConversation = await chatService.isUserInConversation(
      conversatieId,
      req.user.utilizator_id
    );
    if (!isInConversation) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Nu aveți acces la această conversație",
      });
    }

    const markedCount = await chatService.markMessagesAsRead(
      conversatieId,
      req.user.utilizator_id
    );

    // Notifică prin Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(`conversation_${conversatieId}`).emit("messages_read", {
        conversatie_id: conversatieId,
        user_id: req.user.utilizator_id,
        read_at: new Date(),
        marked_count: markedCount,
      });
    }

    res.json({
      success: true,
      data: { marked_count: markedCount },
      message: `${markedCount} mesaje marcate ca citite`,
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Șterge un mesaj
router.delete("/messages/:id", async (req, res) => {
  try {
    const mesajId = req.params.id;

    const deletedMessage = await chatService.deleteMessage(
      mesajId,
      req.user.utilizator_id
    );

    if (!deletedMessage) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message:
          "Mesajul nu a fost găsit sau nu aveți permisiunea să îl ștergeți",
      });
    }

    res.json({
      success: true,
      data: deletedMessage,
      message: "Mesaj șters cu succes",
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Obține statistici conversație
router.get("/conversations/:id/stats", async (req, res) => {
  try {
    const conversatieId = req.params.id;

    const isInConversation = await chatService.isUserInConversation(
      conversatieId,
      req.user.utilizator_id
    );
    if (!isInConversation) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Nu aveți acces la această conversație",
      });
    }

    const stats = await chatService.getConversationStats(conversatieId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting conversation stats:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// Middleware pentru gestionarea erorilor de upload
router.use(handleUploadError);

module.exports = router;
