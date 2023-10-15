const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/users', express.static(path.join(__dirname, 'users')));



// Set storage engine for multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const username = req.cookies.username;
        const imagesDir = path.join(__dirname, `${username}`, 'images');
        if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
        }
        cb(null, imagesDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Route to handle the form submission
app.post('/saveData', (req, res) => {
    const { username, email, password } = req.body;

    const usersDir = path.join(__dirname, 'users');
    if (!fs.existsSync(usersDir)) {
        fs.mkdirSync(usersDir);
    }

    // Create a directory with the username inside the 'users' directory
    const userDir = path.join(usersDir, username);
    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir);
    }

    // Write the data to data.txt
    fs.writeFileSync(path.join(userDir, 'data.txt'), `Username: ${username}\nPassword: ${password}\nEmail: ${email}`);

    res.send('Data saved successfully!');
});

const upload = multer({ storage: storage });
app.post('/addPost', upload.single('image'), (req, res) => {
    const { description } = req.body || {};

    fs.readFile(path.join(__dirname, 'users', 'login.txt'), 'utf8', (err, data) => {
        if (err) {
            res.send('Error reading login data');
        } else {
            const username = data.split('\n').pop().trim();
            if (!username) {
                res.send('Username not found');
                return;
            }

            const imagePath = `users/${username}/images/${Date.now()}-${Math.round(Math.random() * 1E9)}.${req.file.originalname.split('.').pop()}`;
            const dataToWrite = `Username: ${username}\nDescription: ${description}\nImage path: ${imagePath}`;

            const imagesDir = path.join(__dirname, 'users', username, 'images');
            const postDir = path.join(__dirname, 'users', username, 'post');

            if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
            }

            if (!fs.existsSync(postDir)) {
                fs.mkdirSync(postDir, { recursive: true });
            }

            const imagePathInDir = path.join(imagesDir, imagePath.split('/').pop());
            fs.renameSync(req.file.path, imagePathInDir);

            fs.writeFileSync(path.join(postDir, `${imagePath.split('/').pop()}.txt`), dataToWrite);
            res.redirect(`/main`); 
            
        }
    });
});





// Route to handle login
// Route to handle login
app.post('/login', (req, res) => {
    const { username, password } = req.body || {}; // Adding a default empty object for destructuring

    if (!username) {
        return res.status(400).send('Username is missing in the request.');
    }

    const loginFilePath = path.join(__dirname, 'users', 'login.txt');

    // Read data from the file
    let loginData = fs.readFileSync(loginFilePath, 'utf8');

    const storedUsernames = loginData.split('\n').map(line => line.split(': ')[1]);

    // Remove existing usernames
    storedUsernames.forEach((storedUsername, index) => {
        if (storedUsername === username) {
            storedUsernames.splice(index, 1);
        }
    });

    // Write the updated usernames back to login.txt
    const updatedLoginData = storedUsernames.join('\n');
    fs.writeFileSync(loginFilePath, updatedLoginData);

    // Append the new username to login.txt
    fs.appendFileSync(loginFilePath, `${username}`);

    // Read data from the file
    fs.readFile(path.join(__dirname, 'users', username, 'data.txt'), 'utf8', (err, data) => {
        if (err) {
            res.send('Invalid username or password');
        } else {
            const storedPassword = data.split('\n')[1].split(': ')[1];
            if (password === storedPassword) {
                res.redirect(`/main?username=${username}`); // Redirect to main.html with the username as a query parameter
            } else {
                res.send('Invalid username or password');
            }
        }
    });
});








// Import the lodash library
const _ = require('lodash');

app.get('/getAllPosts', (req, res) => {
    const mainFolder = path.join(__dirname, 'users');
    const users = fs.readdirSync(mainFolder);

    let allPosts = [];

    users.forEach(user => {
        const userFolder = path.join(mainFolder, user, 'post');
        if (fs.existsSync(userFolder)) {
            const userPosts = fs.readdirSync(userFolder);
            userPosts.forEach(post => {
                const postFile = path.join(userFolder, post);
                const postContent = fs.readFileSync(postFile, 'utf-8');
                const lines = postContent.split('\n');
                if (lines.length >= 3) {
                    const usernameLine = lines.find(line => line.startsWith('Username:'));
                    const descriptionLine = lines.find(line => line.startsWith('Description:'));
                    const imagePathLine = lines.find(line => line.startsWith('Image path:'));

                    if (usernameLine && descriptionLine && imagePathLine) {
                        const username = usernameLine.split(':').slice(1).join(':').trim();
                        const description = descriptionLine.split(':').slice(1).join(':').trim();
                        const imagePath = imagePathLine.split(':').slice(1).join(':').trim();

                        allPosts.push({
                            username,
                            description,
                            imagePath,
                        });
                    } else {
                        console.error('Data format error in file:', postFile);
                    }
                } else {
                    console.error('Data format error in file:', postFile);
                }
            });
        }
    });

    // Shuffle the allPosts array
    allPosts = _.shuffle(allPosts);

    res.json(allPosts);
});






app.get('/getuserPost', (req, res) => {
    const loginFilePath = path.join(__dirname, 'users', 'login.txt');
    let username = '';

    try {
        const loginData = fs.readFileSync(loginFilePath, 'utf8');
        username = loginData.trim();
    } catch (err) {
        console.error('Error reading login data:', err);
        res.send('Error reading login data');
        return;
    }

    if (!username) {
        res.send('Username not found');
        return;
    }

    const userFolder = path.join(__dirname, 'users', username, 'post');
    if (!fs.existsSync(userFolder)) {
        res.json([]);
        return;
    }

    const userPosts = fs.readdirSync(userFolder);
    const allPosts = [];

    userPosts.forEach(post => {
        const postFile = path.join(userFolder, post);
        const postContent = fs.readFileSync(postFile, 'utf-8');
        const lines = postContent.split('\n');
        if (lines.length >= 3) {
            const usernameLine = lines.find(line => line.startsWith('Username:'));
            const descriptionLine = lines.find(line => line.startsWith('Description:'));
            const imagePathLine = lines.find(line => line.startsWith('Image path:'));

            if (usernameLine && descriptionLine && imagePathLine) {
                const username = usernameLine.split(':').slice(1).join(':').trim();
                const description = descriptionLine.split(':').slice(1).join(':').trim();
                const imagePath = imagePathLine.split(':').slice(1).join(':').trim();

                allPosts.push({
                    username,
                    description,
                    imagePath,
                });
            } else {
                console.error('Data format error in file:', postFile);
            }
        } else {
            console.error('Data format error in file:', postFile);
        }
    });

    res.json(allPosts);
});







// Route to handle the root endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/loginUser', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});
app.get('/main', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

app.get('/add', (req, res) => {
    res.sendFile(path.join(__dirname, 'add.html'));
});
app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'profile.html'));
});




// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
