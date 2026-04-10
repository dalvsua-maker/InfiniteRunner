const express = require('express');
const cors = require('cors'); // Asegúrate de que esta línea esté
const mysql = require('mysql2');

const app = express();

// Sustituye tu bloque manual por este:
app.use(cors({
    origin: '*', // Permite que cualquier persona desde cualquier sitio envíe datos
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());






// Configuración de la conexión a MySQL
const db = mysql.createConnection({
    host: 'maglev.proxy.rlwy.net', // Sacado de la imagen
    user: 'root',                  // El usuario por defecto
    password: 'DMvFqnIswnmdZNcAIoGBAQjjBMgJEekO',  // Dale a "show" en Railway para verla
    database: 'railway',           // Es el nombre al final de la URL
    port: 56795                    // El número después de los dos puntos
});

db.connect(err => {
    if (err) {
        console.error("❌ Error conectando a Railway: " + err.message);
        return;
    }
    console.log("✅ Servidor conectado a la base de datos en la NUBE (Railway)");
});

app.get('/', (req, res) => {
    res.send("Servidor del Vaquero funcionando ✅");
});

// Ruta para guardar puntuación
app.post('/guardar-score', (req, res) => {
    const { nombre, puntos, dificultad } = req.body;
    
    // Verificamos que lleguen datos para que el servidor no se rompa
    if(!nombre || puntos === undefined) return res.status(400).send("Datos incompletos");

    db.query('INSERT IGNORE INTO usuarios (nombre) VALUES (?)', [nombre], () => {
        db.query('SELECT id FROM usuarios WHERE nombre = ?', [nombre], (err, result) => {
            if (err || !result[0]) return res.status(500).send("Error usuario");
            
            const usuario_id = result[0].id;
            db.query('INSERT INTO scores (usuario_id, puntos, dificultad) VALUES (?, ?, ?)', 
            [usuario_id, puntos, dificultad], (err) => {
                if (err) return res.status(500).send(err);
                res.send({ mensaje: "Puntuación guardada" });
            });
        });
    });
});

// Ruta para obtener el Top 5 de High Scores únicos
app.get('/top-scores', (req, res) => {
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

