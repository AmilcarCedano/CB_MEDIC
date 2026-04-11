const router = require('express').Router();
router.get('/', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});
module.exports = router;
