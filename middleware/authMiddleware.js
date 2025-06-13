const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'labai_slaptas_raktas';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Paima tik token dalį

  if (!token) {
    return res.status(401).json({ error: 'Reikalingas prisijungimas (tokenas)' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Neleistinas tokenas' });
    req.user = user; // įrašom userį į request'ą
    next();
  });
}

module.exports = authenticateToken;
