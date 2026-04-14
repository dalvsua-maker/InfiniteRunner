const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
require('dotenv').config(); // <-- 1. IMPORTANTE: Carga las variables del archivo .env

const app = express();

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
}));

app.use(express.json());

// 2. Configuración usando variables de entorno
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

db.connect((err) => {
  if (err) {
    console.error(" Error conectando a la BD: " + err.message);
    return;
  }
  console.log(" Servidor conectado a la base de datos");
});

app.get("/", (req, res) => {
  res.send("Servidor del Vaquero funcionando ");
});

// Ruta para guardar puntuación
app.post("/guardar-score", (req, res) => {
  const { nombre, puntos, dificultad } = req.body;

  // Verificamos que lleguen datos para que el servidor no se rompa
  if (!nombre || puntos === undefined)
    return res.status(400).send("Datos incompletos");

  db.query("INSERT IGNORE INTO usuarios (nombre) VALUES (?)", [nombre], () => {
    db.query(
      "SELECT id FROM usuarios WHERE nombre = ?",
      [nombre],
      (err, result) => {
        if (err || !result[0]) return res.status(500).send("Error usuario");

        const usuario_id = result[0].id;
        db.query(
          "INSERT INTO scores (usuario_id, puntos, dificultad) VALUES (?, ?, ?)",
          [usuario_id, puntos, dificultad],
          (err) => {
            if (err) return res.status(500).send(err);
            res.send({ mensaje: "Puntuación guardada" });
          },
        );
      },
    );
  });
});
app.get("/mi-record", (req, res) => {
  const { nombre, dificultad } = req.query;

  const query = `
        SELECT MAX(s.puntos) as record 
        FROM scores s 
        JOIN usuarios u ON s.usuario_id = u.id 
        WHERE u.nombre = ? AND s.dificultad = ?
    `;

  db.query(query, [nombre, dificultad], (err, result) => {
    if (err) return res.status(500).send(err);
    const record = result[0].record || 0;
    res.json({ record });
  });
});
// Ruta para obtener el Top 5 de High Scores únicos
app.get("/top-scores", (req, res) => {
  // Leemos la dificultad que viene en la URL
  const dificultad = req.query.dificultad;

  const query = `
        SELECT u.nombre, MAX(s.puntos) as puntos 
        FROM scores s 
        JOIN usuarios u ON s.usuario_id = u.id 
        WHERE s.dificultad = ?
        GROUP BY u.id 
        ORDER BY puntos DESC 
        LIMIT 5
    `;

  db.query(query, [dificultad], (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
