const express = require('express');
const router = express.Router();

router.post('/booking', (req, res) => {
  res.json({
    success: true,
    message: '已收到預訂請求',
    requestBody: req.body,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
