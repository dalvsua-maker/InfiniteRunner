const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();

// Borra el app.use(cors()) anterior y pon estas 4 líneas justo después de "const app = express();"
app.use(cors()); // Esto usa la librería que ya importaste arriba
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

    // 1. Insertar o buscar el usuario
    db.query('INSERT IGNORE INTO usuarios (nombre) VALUES (?)', [nombre], () => {
        db.query('SELECT id FROM usuarios WHERE nombre = ?', [nombre], (err, result) => {
            const usuario_id = result[0].id;
            
            // 2. Guardar el score
            db.query('INSERT INTO scores (usuario_id, puntos, dificultad) VALUES (?, ?, ?)', 
            [usuario_id, puntos, dificultad], (err) => {
                if (err) return res.status(500).send(err);
                res.send({ mensaje: "Puntuación guardada" });
            });
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));

