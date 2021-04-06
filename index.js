const express = require('express')
const mongoose = require('mongoose')
const app = express()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const {secret} = require('./config')
const {LocalStorage} = require('node-localstorage')
const http = require('http').createServer(app);
const io = require('socket.io')(http)
const Schema = mongoose.Schema;

const articleSchema = new Schema({
    name: String,
    message: String,
    status: String,
    filename: String,
    date: String,
}, {versionKey: false})

const userSchema = new Schema({
    email: {type: String, unique: true, required: true},
    pass: {type: String, unique: true, required: true}
}, {versionKey: false})

const articles = mongoose.model("Article", articleSchema)
const users = mongoose.model("User", userSchema)


const generateAccessToken = (id, name) => {
    const payload = {
        id,
        name
    }
    return jwt.sign(payload, secret, {expiresIn: "24h"})
}
app.use(express.json())
const PORT = process.env.PORT || 3000

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html')
})
connections = [];

io.sockets.on('connection', function (socket) {
    let ARTICLES = []

    async function getArticles() {
        await articles.find({},
            function (err, articles) {
                if (err) return console.log(err)
                console.log("Статьи загружены", articles)
                io.sockets.emit('post articles', {articles})
            })
    }

    console.log("Успешное соединение")
    connections.push(socket)

    socket.on('disconnect', function (data) {
        connections.splice(connections.indexOf(socket), 1)
        console.log("Отключились")
    })
    socket.on("send newarticle", function (name, message, status, filename, date) {
        try {
            addArticleToDB(name, message, status, filename, date)
        } catch (e) {
            console.log(e)
        }
    });

    socket.on("get articles", function (data) {
        try {
            getArticles()
        } catch (e) {
            console.log(e)
        }
    });
    socket.on("login", function (email, password) {
        try {
            Authorization(email, password)
        } catch (e) {
            console.log(e)
        }
    });
    socket.on("signup", function (email, password) {
        try {
            Registration(email, password)
        } catch (e) {
            console.log(e)
        }
    });
    socket.on("exit", function (data) {
        try {
            Exit()
        } catch (e) {
            console.log(e)
        }
    });

});

async function Exit() {
    io.sockets.emit('delete token')
}

async function Authorization(email, password) {
    try {
        const existUser = await users.findOne({
            email: email
        });
        if (existUser !== null) {
            console.log(existUser.pass)
            const validPassword = await bcrypt.compareSync(password, existUser.pass)
            if (!validPassword) {
                console.log("пароли не совпадают")
            } else {
                let token = await generateAccessToken(existUser._id, email);
                io.sockets.emit('post token', token)
            }
        } else {
            console.log("нет такого пользователя")
        }
    } catch (e) {
        console.log(e)
    }
}

async function Registration(email, password) {
    try {
        const candidate = await users.findOne({
            email: email
        });
        if (candidate == null) {
            const hashPassword = bcrypt.hashSync(password, 4)
            console.log(hashPassword)
            await users.create({
                    email: email,
                    pass: hashPassword
                },
                async function (err, doc) {
                    if (err) return console.log(err);
                    console.log(doc);
                });
        } else {

        }
    } catch (e) {
        console.log(e)
    }
}

async function addArticleToDB(name, message, status, filename, date) {
    await articles.create({
            name: name,
            message: message,
            status: status,
            filename: filename,
            date: date
        },
        function (err, doc) {
            if (err) return console.log(err)
            console.log("Новая статья сохранена", doc)

        })
}

async function getArticleFromDB() {
    await articles.find({},
        function (err, articles) {
            if (err) return console.log(err)
            console.log("Статьи загружены", articles)
            ARTICLES = articles
            return articles;
        })
}

async function start() {
    try {
        await mongoose.connect('mongodb+srv://dima:1088834@cluster0.uwrbc.mongodb.net/websokets',
            {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                useFindAndModify: false
            }
        )
        http.listen(PORT, () => {
            console.log('Server has been started...')
        })
    } catch (e) {
        console.log(e)
    }
}

start()