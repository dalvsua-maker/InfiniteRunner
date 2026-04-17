/**
 * @fileoverview FORASTERO RUNNER — server.js
 * Servidor Express que expone la API REST del juego.
 * Gestiona la persistencia de puntuaciones en MySQL y sirve
 * los rankings globales por dificultad.
 *
 * Rutas disponibles:
 *   GET  /              → Comprobación de estado del servidor
 *   POST /guardar-score → Registra una puntuación al finalizar la partida
 *   GET  /mi-record     → Devuelve el récord personal de un jugador
 *   GET  /top-scores    → Devuelve el Top 5 global de una dificultad
 *
 * Variables de entorno requeridas (.env):
 *   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT, PORT
 */

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");

// Carga las variables de entorno desde el archivo .env al proceso
require('dotenv').config();

const app = express();

// ─── MIDDLEWARES ──────────────────────────────────────────────────────────────

/**
 * CORS: permite peticiones desde cualquier origen.
 * Necesario para que el cliente (HTML/JS en el navegador) pueda llamar
 * al servidor aunque estén en dominios distintos (ej. GitHub Pages → Render).
 * Se permiten explícitamente los métodos GET, POST y OPTIONS (preflight).
 */
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
}));

/** Parsea el body de las peticiones entrantes como JSON */
app.use(express.json());

// ─── BASE DE DATOS ────────────────────────────────────────────────────────────

/**
 * Conexión a la base de datos MySQL.
 * Todas las credenciales se leen de variables de entorno para
 * no exponer datos sensibles en el código fuente.
 * @type {mysql.Connection}
 */
const db = mysql.createConnection({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port:     process.env.DB_PORT,
});

/**
 * Intenta establecer la conexión a la BD al arrancar el servidor.
 * Si falla, registra el error en consola pero el proceso no se detiene
 * (las rutas devolverán error 500 si se intentan usar sin conexión).
 */
db.connect((err) => {
  if (err) {
    console.error("Error conectando a la BD: " + err.message);
    return;
  }
  console.log("Servidor conectado a la base de datos");
});

// ─── RUTAS ────────────────────────────────────────────────────────────────────

/**
 * GET /
 * Ruta de comprobación de estado (health check).
 * Útil para verificar que el servidor está activo en Render u otro hosting.
 */
app.get("/", (req, res) => {
  res.send("Servidor del Vaquero funcionando");
});

/**
 * POST /guardar-score
 * Registra la puntuación de un jugador al terminar la partida.
 *
 * Flujo:
 *   1. Valida que el body incluya `nombre` y `puntos`.
 *   2. Inserta al jugador en `usuarios` si aún no existe (INSERT IGNORE).
 *   3. Recupera el `id` del jugador.
 *   4. Inserta la puntuación en `scores` vinculada al jugador y la dificultad.
 *
 * @param {Object} req.body
 * @param {string} req.body.nombre     - Nombre del jugador.
 * @param {number} req.body.puntos     - Puntuación obtenida en la partida.
 * @param {string} req.body.dificultad - "Normal" o "Extremo".
 */
app.post("/guardar-score", (req, res) => {
  const { nombre, puntos, dificultad } = req.body;

  // Validación mínima: evita insertar registros vacíos o corruptos
  if (!nombre || puntos === undefined)
    return res.status(400).send("Datos incompletos");

  // Paso 1: crear el usuario si no existe (el índice UNIQUE en `nombre` previene duplicados)
  db.query("INSERT IGNORE INTO usuarios (nombre) VALUES (?)", [nombre], () => {

    // Paso 2: recuperar el id asignado al usuario
    db.query(
      "SELECT id FROM usuarios WHERE nombre = ?",
      [nombre],
      (err, result) => {
        if (err || !result[0]) return res.status(500).send("Error usuario");

        const usuario_id = result[0].id;

        // Paso 3: insertar la entrada de puntuación
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

/**
 * GET /mi-record
 * Devuelve la puntuación máxima histórica de un jugador concreto
 * para una dificultad específica.
 * Se usa al inicio de la partida para sincronizar el récord local
 * del cliente con el valor real del servidor.
 *
 * @param {string} req.query.nombre     - Nombre del jugador.
 * @param {string} req.query.dificultad - "Normal" o "Extremo".
 * @returns {Object} JSON con el campo `record` (número, 0 si no tiene entradas).
 */
app.get("/mi-record", (req, res) => {
  const { nombre, dificultad } = req.query;

  // MAX(puntos) por jugador y dificultad; si no hay filas devuelve NULL → se coerce a 0
  const query = `
        SELECT MAX(s.puntos) as record 
        FROM scores s 
        JOIN usuarios u ON s.usuario_id = u.id 
        WHERE u.nombre = ? AND s.dificultad = ?
    `;

  db.query(query, [nombre, dificultad], (err, result) => {
    if (err) return res.status(500).send(err);
    const record = result[0].record || 0; // NULL se convierte en 0
    res.json({ record });
  });
});

/**
 * GET /top-scores
 * Devuelve el Top 5 de jugadores únicos con mayor puntuación
 * para la dificultad indicada.
 * Agrupa por jugador (GROUP BY u.id) para mostrar solo el mejor intento
 * de cada uno (MAX), evitando que un mismo jugador acapare varias posiciones.
 *
 * @param {string} req.query.dificultad - "Normal" o "Extremo".
 * @returns {Array<{nombre: string, puntos: number}>} Lista ordenada de mayor a menor.
 */
app.get("/top-scores", (req, res) => {
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

// Ruta para el Leaderboard con paginación
app.get("/leaderboard", (req, res) => {
  const dificultad = req.query.dificultad || "Normal";
  const limite = parseInt(req.query.limit) || 10;
  const pagina = parseInt(req.query.page) || 1;
  const offset = (pagina - 1) * limite;

  // 1. Consulta para obtener los datos
  const queryData = `
    SELECT u.nombre, MAX(s.puntos) as puntos 
    FROM scores s 
    JOIN usuarios u ON s.usuario_id = u.id 
    WHERE s.dificultad = ?
    GROUP BY u.id 
    ORDER BY puntos DESC 
    LIMIT ? OFFSET ?
  `;

  // 2. Consulta para saber el total de páginas
  const queryCount = `
    SELECT COUNT(DISTINCT usuario_id) as total 
    FROM scores 
    WHERE dificultad = ?
  `;

  db.query(queryCount, [dificultad], (err, countResult) => {
    if (err) return res.status(500).send(err);
    
    const totalRegistros = countResult[0].total;
    const totalPaginas = Math.ceil(totalRegistros / limite);

    db.query(queryData, [dificultad, limite, offset], (err, results) => {
      if (err) return res.status(500).send(err);
      res.json({
        data: results,
        totalPaginas: totalPaginas,
        paginaActual: pagina
      });
    });
  });
});

// ─── ARRANQUE ─────────────────────────────────────────────────────────────────

/**
 * Inicia el servidor HTTP en el puerto definido por la variable de entorno PORT,
 * o en el 3000 por defecto (útil para desarrollo local).
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));