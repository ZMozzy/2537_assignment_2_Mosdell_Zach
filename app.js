require('dotenv').config();
const path = require('path');

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_user_database = process.env.MONGODB_USER_DATABASE;
const mongodb_session_database = process.env.MONGODB_SESSION_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const mongoSanitizer = require('mongo-sanitizer').default;
const app = express();
app.set('view engine', 'ejs');
//res.render('index');

// function isValidSession(req) {
// if (req.session && req.session.authenticated) {
//     return true;
// }
// return false;
// }

// function sessionValidation(req, res, next) {
//     if (isValidSession(req)) {
//         next();
//     } else {
//         res.redirect('/login');
//     }
// }

//app.use('/members', sessionValidation);
// calls next which would be app.get('/loggedin

//app.get('/loggedin', sessionValidation, (req, res) => {
    //alternate

//app.use((req,res,next) => {
    //const pathFolders = req.path.split("/").slice(1);
    //const foler = "/" + pathFolders[0];
    //app.locals.folder = folder;
    //app.locals.navLinks = navLinks;
    //next();

const port = process.env.PORT || 3000;


const {database} = require('./dbconnect');
let userCollection = database.db(mongodb_user_database).collection('users');

var mongoStore = (MongoStore.create || MongoStore.default.create)({
	mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_session_database}`,
	crypto: {
		secret: mongodb_session_secret
	}
});

app.use(session({
    secret: node_session_secret,
    store: mongoStore,
    resave: true,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 }//1hr
}));

app.use(express.urlencoded({ extended: false }));

app.use(mongoSanitizer(
    {replaceWith: '_'}
));

// Initialize database connection and start server
database.on('connect', () => {
	console.log('App initialized with database');
});

app.get('/', (req, res) => {
    if (!req.session.authenticated) {
        res.render('guest');
    } else {
        res.render('loggedIn', { username: req.session.username });
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

//look
app.post('/loggingIn', async (req, res) => {
    const { email, password } = req.body;
    const user = await userCollection.findOne({ email: email });
    if (!user) {
        //look at/////////////////
        return res.status(401).render('login', { error: 'Invalid email or password' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        //////look at/////////////////
        return res.status(401).render('login', { error: 'Invalid email or password' });
    }
    req.session.authenticated = true;
    req.session.username = user.username;
    req.session.email = user.email;
    req.session.type = user.type;

    req.session.save(() => {
        res.redirect('/');
    });
});

app.get('/register', (req, res) => {
    res.render('register');
});

//look
app.post('/registering', async (req, res) => {
    const { username, email, password } = req.body;
    const existingUser = await userCollection.findOne({ email: email });
    if (existingUser) {
        //////look at/////////////////
        return res.status(400).render('register', { error: 'Email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    await userCollection.insertOne({ username: username, email: email, password: hashedPassword, type: 'user' });
    
    req.session.authenticated = true;
    req.session.username = username;
    req.session.email = email;
    req.session.type = 'user';
    req.session.save(() => {
        res.redirect('/');
    });
});


app.get('/members', (req, res) => {
    const catImage = [
        '/cutecat.jpg',
        '/suscat.jpg',
        '/fatcat.jpg'
    ]

    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        res.render('members', { username: req.session.username, cats: catImage });
    }
});

app.get('/admin', async (req, res) => {
    try {
        if (!req.session.authenticated) {
            return res.redirect('/login');
        }

        if (req.session.type !== 'admin') {
            console.log("Access denied for:", req.session.username);
            return res.status(403).send("Forbidden: Admins only");
        }

        res.render('admin', { 
            adminName: req.session.username,
            users: await userCollection.find({}).toArray()
        });

    } catch (error) {
        console.error("Database error:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/promote', async (req, res) => {
    try {
        await userCollection.updateOne(
            { email: req.body.email },
            { $set: { type: 'admin' } }
        );
        res.redirect('/admin');
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/demote', async (req, res) => {
    try {
        await userCollection.updateOne(
            { email: req.body.email },
            { $set: { type: 'user' } }
        );
        res.redirect('/admin');
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.use(express.static(path.join(__dirname, '/public')));


app.use((req, res) => {
    res.status(404).render('404');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});