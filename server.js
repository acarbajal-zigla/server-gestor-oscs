require('dotenv').config()

const express = require('express');
const bcrypt = require('bcrypt');
const mysql = require('mysql');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();

const posts = [];

app.use(cors());
app.options('*', cors());

app.use(express.json())

const conn = mysql.createConnection({
    host: 'localhost',
    user: 'root'
});

conn.connect(function (err) {
    if (err) throw err;
    console.log("Base de datos conectada correctamente.");
});
conn.query("USE gestoroscs;");

app.use(express.json());

app.get('/posts', authenticateToken, (req, res) => {
    res.json(posts.filter(post => post.name === req.username))
})

app.post('/donativos/registro', authenticateToken, (req, res) => {
    const username = posts.filter(post => post.name === req.username)
    if (username) {
        let osc = ''
        conn.query(`SELECT osc FROM users WHERE username=${username};`, function (err, results, fields) {
            if (err) console.log("[mysql error]", err);
            osc = results[0]['osc']
        });
        if (osc.length) {
            conn.query(`INSERT INTO donativos (donante, destinatario, monto, fecha, concepto) VALUES ("${osc}","${req.destinatario}",${req.monto},"${req.fecha}","${req.concepto});`, function (err, results, fields) {
                if (err) {
                    console.log("[mysql error]", err);
                    res.status(500).send();
                }
                res.status(200).send();
            });
        }
    }
    res.json()
})

app.get('/donativos/registro', authenticateToken, (req, res) => {
    res.sendFile('views/registro_donativos.html', { root: __dirname });
});

app.get('/users', (req, res) => {
    conn.query("SELECT username FROM users;", function (err, results, fields) {
        if (err) {
            console.log("[mysql error]", err);
            res.status(500).send();
        }
        res.status(200).send(JSON.stringify(results));
        //res.render('users', { 'title': 'users', 'result': results[0] });
    });
});

// bcrypt es asincrónica entonces tengo que poner el modif async y usar try y catch
app.post('/users', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        conn.query(`INSERT INTO users (username, email, password, usertype) VALUES ("${req.body.username}", "${req.body.email}", "${hashedPassword}", "${req.body.usertype}");`, function (err, results, fields) {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    res.status(409).send('El usuario ya existe');
                }
                else {
                    console.log("[mysql error]", err);
                    res.status(500).send();
                }
            }
            else {
                res.status(201).send('Usuario creado');
            }
        });
    }
    catch {
        res.status(500).send();
    }
});

app.post('/users/login', async (req, res) => {
    conn.query(`SELECT username, password FROM users WHERE username="${req.body.username}";`, async function (err, results, fields) {
        if (err) {
            console.log("[mysql error]", err);
            res.status(500).send();
        }
        else if (results.length === 0) {
            res.status(404).send('Usuario inexistente');
        }
        else {
            try {
                if (await bcrypt.compare(req.body.password, results[0].password)) {
                    const username = req.body.username;
                    const access_token = jwt.sign({ name: username }, process.env.ACCESS_TOKEN_SECRET);
                    res.status(200).json({ "access_token": access_token })
                    posts.push({ "username": username })
                }
                else {
                    res.send('Acceso incorrecto');
                }
            }
            catch {
                res.status(500).send();
            }
        }
    });
});

let refreshTokens = []; // Esto debería ir a una base de datos idealmente

app.post('/token', (req, res) => {
    const refreshToken = req.body.token;
    if (refreshToken == null) return res.sendStatus(401);
    if (!refreshTokens.includes(refreshToken)) return res.sendStatus(403);
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        const accessToken = generateAccessToken({ name: user.name });
        res.json({ accessToken: accessToken });
    })
});

app.delete('/logout', (req, res) => {
    // Elimino el token de la lista al hacer logout
    refreshTokens = refreshTokens.filter(token => token !== req.body.token)
    res.sendStatus(204)
})

app.post('/login', (req, res) => {
    // Autenticar usuario
    console.log(req)
    const data = req.body
    const user = { name: data.username }

    const accessToken = generateAccessToken(user)
    const refreshToken = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET)
    refreshTokens.push(refreshToken)
    res.json({ accessToken: accessToken, refreshToken: refreshToken })
})

function generateAccessToken(user) {
    return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '20m' })
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato "Bearer TOKEN"
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        console.log(err);
        if (err) return res.sendStatus(403); // Si err --> no tiene acceso, no es válido el token
        req.user = user;
        next();
    })
}

app.listen(3000);

