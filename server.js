const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const app = express();
// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/users', express.static(path.join(__dirname, 'users')));



// Set storage engine for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const username = req.cookies.username || 'default_username'; // Set a default username if not found
    const imagesDir = path.join(__dirname, 'users', username, 'images');
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


const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post('/saveData', (req, res) => {
  const { username, email, password } = req.body;

  // Check if the username contains any uppercase letters
  const hasUpperCase = /[A-Z]/.test(username);
  if (hasUpperCase) {
    const errorMessage = 'Enter the Lower Case Only';
    return res.status(400).send(errorMessage);
  }

  const usersDir = path.join(__dirname, 'users');
  if (!fs.existsSync(usersDir)) {
    fs.mkdirSync(usersDir);
  }

  // Create a directory with the username inside the 'users' directory
  const userDir = path.join(usersDir, username);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir);
  }

  const dataToWrite = `Username: ${username}\nPassword: ${password}\nEmail: ${email}`;
  fs.writeFileSync(path.join(userDir, 'data.txt'), dataToWrite);

  res.redirect('/loginUser');
});







// Function to get the sender's username from the file
function getSenderUsername() {
  const loginFilePath = path.join(__dirname, 'users', 'login.txt');
  const loginData = fs.readFileSync(loginFilePath, 'utf8');
  const usernames = loginData.split('\n');
  return usernames[0]; // Assuming the sender's username is the first line
}


app.post('/postComment', (req, res) => {
  const { postId, comment, username } = req.body;
  const senderUsername = getSenderUsername();

  if (!postId || !comment || !username || !senderUsername) {
    res.status(400).send('Incomplete data. Please provide postId, comment, username, and senderUsername.');
    return;
  }

  const { v4: uuidv4 } = require('uuid');
  const commentId = uuidv4();

  const fileNameWithoutExtension = postId.split('.').slice(0, -1).join('.');
  const postDirectory = path.join(__dirname, 'users', username, 'post', fileNameWithoutExtension);
  const filePath = path.join(postDirectory, 'data.txt'); // Updated path to include the 'data.txt' file

  const commentData = `CommentId: ${commentId}\nUsername: ${username}\nComment: ${comment}\nSenderUsername: ${senderUsername}`;
  const commentDataWithSeparator = `\n\n${commentData}`;

  // Check if the directory already exists, if not, create it
  if (!fs.existsSync(postDirectory)) {
    fs.mkdirSync(postDirectory, { recursive: true });
  }

  // Check if the file already exists, if not, create it
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, commentDataWithSeparator, 'utf-8');
  } else {
    fs.appendFileSync(filePath, commentDataWithSeparator, 'utf-8');
  }

  res.sendStatus(200);
});






app.post('/deleteComment', (req, res) => {
  const { commentId, postImagePath } = req.body;

  if (!commentId || !postImagePath) {
    res.status(400).send('Incomplete data. Please provide commentId and postImagePath.');
    return;
  }

  const fs = require('fs');
  const path = require('path');

  // Extract the username from the postImagePath
  const usernameMatch = postImagePath.match(/^users\/([^/]+)/);
  if (!usernameMatch) {
    res.status(400).send('Invalid postImagePath format.');
    return;
  }

  const username = usernameMatch[1]; // Extracted username
  const filePath = path.join(__dirname, 'users', username, 'post', `${path.basename(postImagePath, path.extname(postImagePath))}`, 'data.txt'); // Updated file path to point to data.txt

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading comments:', err);
      res.status(500).send('Error reading comments');
      return;
    }

    const comments = data.split('\n\n');
    let commentFound = false;

    // Filter out the comment with the provided commentId
    const filteredComments = comments.filter(commentBlock => {
      const commentData = {};
      commentBlock.split('\n').forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          commentData[key.trim()] = value.trim();
        }
      });

      if (commentData['CommentId'] === commentId) {
        commentFound = true;
        return false;
      }

      return true;
    });

    if (!commentFound) {
      res.status(404).send('Comment not found');
      return;
    }

    // Update the file with the filtered comments
    fs.writeFile(filePath, filteredComments.join('\n\n'), (err) => {
      if (err) {
        console.error('Error deleting comment:', err);
        res.status(500).send('Error deleting comment');
      } else {
        res.sendStatus(200);
      }
    });
  });
});






app.get('/getComments', (req, res) => {
  const { username, postImagePath } = req.query;
  const postFilePath = path.join(__dirname, 'users', username, 'post', `${path.basename(postImagePath, path.extname(postImagePath))}`, 'data.txt'); // Updated file path to point to data.txt

  fs.readFile(postFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error fetching comments:', err);
      res.status(500).send('Error fetching comments');
    } else {
      const comments = [];
      const commentBlocks = data.split('\n\n');

      commentBlocks.forEach(commentBlock => {
        const commentData = {};
        const lines = commentBlock.split('\n');
        lines.forEach(line => {
          const [key, value] = line.split(':');
          if (key && value) {
            commentData[key.trim()] = value.trim();
          }
        });
        if (Object.keys(commentData).length !== 0) {
          comments.push(commentData);
        }
      });

      res.send(comments);
    }
  });
});

















const os = require('os');


// Route to handle login
// Route to handle login
// Route to handle login
app.post('/login', (req, res) => {
  const { username, password } = req.body || {}; // Adding a default empty object for destructuring

  if (!username) {
    return res.status(400).send('Username is missing in the request.');
  }
  // Check if the username contains any uppercase letters
  const hasUpperCase = /[A-Z]/.test(username);
  if (hasUpperCase) {
    const errorMessage = 'Enter the Lower Case Only';
    // Redirect to the error route with the error message as a query parameter
    return res.redirect(`/error?message=${errorMessage}`);
  }

  let loginFilePath = path.join('users', 'login.txt');

  // Read data from the file
  let loginData = fs.readFileSync(loginFilePath, 'utf8');

  const storedUsernames = loginData.split('\n').map(line => line.split(': ')[1]);

  // Remove existing usernames
  storedUsernames.forEach((storedUsername, index) => {
    if (storedUsername === username) {
      storedUsernames.splice(index, 1);
    }
  });

  // Read data from the file
  fs.readFile(path.join('users', username, 'data.txt'), 'utf8', (err, data) => {
    if (err) {
      res.send('Invalid username or password');
    } else {
      const storedPassword = data.split('\n')[1].split(': ')[1];
      if (password === storedPassword) {
        // Write the updated usernames back to login.txt
        const updatedLoginData = storedUsernames.join('\n');
        fs.writeFileSync(loginFilePath, updatedLoginData);
        // Append the new username to login.txt
        fs.appendFileSync(loginFilePath, `${username}`);
        // Redirect to main.html with the username as a query parameter
        res.redirect(`/main?username=${username}`);
      } else {
        res.send('Invalid username or password');
      }
    }
  });
});





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
        const postFile = path.join(userFolder, post, 'data.txt'); // Update to include the data file
        const postContent = fs.readFileSync(postFile, 'utf-8');
        const lines = postContent.split('\n');
        if (lines.length >= 4) {
          const usernameLine = lines.find(line => line.startsWith('Username:'));
          const descriptionLine = lines.find(line => line.startsWith('Description:'));
          const profileImagePathLine = lines.find(line => line.startsWith('Profile Image Path:'));
          const imagePathLine = lines.find(line => line.startsWith('Post Image Path:'));

          if (usernameLine && descriptionLine && profileImagePathLine && imagePathLine) {
            const username = usernameLine.split(':').slice(1).join(':').trim();
            const description = descriptionLine.split(':').slice(1).join(':').trim();
            const profileImagePath = profileImagePathLine.split(':').slice(1).join(':').trim();
            const imagePath = imagePathLine.split(':').slice(1).join(':').trim();

            allPosts.push({
              username,
              description,
              profileImagePath,
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
  const username = req.query.username;



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
    const postFile = path.join(userFolder, post, 'data.txt'); // Updated path to include 'data.txt'
    const postContent = fs.readFileSync(postFile, 'utf-8');
    const lines = postContent.split('\n');

    const postObject = {
      username: '',
      description: '',
      profileImagePath: '',
      imagePath: '',
    };

    lines.forEach(line => {
      const [key, value] = line.split(':').map(item => item.trim());
      if (key === 'Username') {
        postObject.username = value;
      } else if (key === 'Description') {
        postObject.description = value;
      } else if (key === 'Profile Image Path') {
        postObject.profileImagePath = value;
      } else if (key === 'Post Image Path') {
        postObject.imagePath = value;
      }
    });

    allPosts.push(postObject);
  });

  res.json(allPosts);
});





app.get('/getProfileImagePath', (req, res) => {
  const username = fs.readFileSync(path.join(__dirname, 'users', 'login.txt'), 'utf8').trim();
  const profileImagesDir = path.join('users', username, 'images', 'profile');
  let imagePath = 'No profile photo found.';

  if (fs.existsSync(profileImagesDir)) {
    const files = fs.readdirSync(profileImagesDir);
    if (files.length > 0) {
      imagePath = `${profileImagesDir}/${files[0]}`;
    }
  }

  res.send(imagePath);
});


// ... (existing code for other functionalities)
const upload_profile = multer({ storage: storage });
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const username = fs.readFileSync(path.join(__dirname, 'users', 'login.txt'), 'utf8').trim();
    const profileImagesDir = path.join(__dirname, 'users', username, 'images', 'profile');
    if (!fs.existsSync(profileImagesDir)) {
      fs.mkdirSync(profileImagesDir, { recursive: true });
    } else {
      const files = fs.readdirSync(profileImagesDir);
      for (const file of files) {
        const filePath = path.join(profileImagesDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath); // Remove previous profile photo
        }
      }
    }
    cb(null, profileImagesDir);
  },
  filename: (req, file, cb) => {
    const username = fs.readFileSync(path.join(__dirname, 'users', 'login.txt'), 'utf8').trim();
    const filename = `${username}${path.extname(file.originalname)}`;
    cb(null, filename);
  }
});

const uploadProfile_profile = multer({ storage: profileStorage });

app.post('/uploadProfilePhoto', uploadProfile_profile.single('profilephoto'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No profile photo uploaded.');
  }
  const imagePath = req.file.path;
  res.send(imagePath);
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

      // Change the path for the profile image to include the username as the filename
      const min = 100;
      const max = 1000;
      const profileImagePath = `users/${username}/images/profile/${username}.jpg`;
      const timestamp = Date.now();
      const imageName = req.file.originalname.split('.').slice(0, -1).join('.');
      const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
      const postImagePath = `users/${username}/images/${imageName}_${randomNumber}.${req.file.originalname.split('.').pop()}`;
      const dataToWrite = `Username: ${username}\nDescription: ${description}\nProfile Image Path: ${profileImagePath}\nPost Image Path: ${postImagePath}`;

      const imagesDir = path.join(__dirname, 'users', username, 'images');
      const postDir = path.join(__dirname, 'users', username, 'post', `${imageName}_${randomNumber}`);

      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }

      if (!fs.existsSync(postDir)) {
        fs.mkdirSync(postDir, { recursive: true });
      }

      const imagePathInDir = path.join(imagesDir, `${imageName}_${randomNumber}.${req.file.originalname.split('.').pop()}`);
      fs.renameSync(req.file.path, imagePathInDir);

      fs.writeFileSync(path.join(postDir, 'data.txt'), dataToWrite);
      res.redirect(`/main`);
    }
  });
});








app.get('/useraccounturl', (req, res) => {
  const username = req.query.user;
  const imagePath = path.join(__dirname, 'users', username, 'images', 'profile', `${username}.jpg`);
  const defaultImagePath = 'https://www.bytewebster.com/img/logo.png'; // Default image path

  // Check if the profile image exists, if not, use the default image
  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
  } else {
    res.sendFile(path.join(__dirname, 'public', 'images', 'default_profile.jpg')); // Sending a default image if the user's profile image doesn't exist
  }
});





app.get('/main', (req, res) => {
  fs.readFile(path.join(__dirname, 'users', 'login.txt'), 'utf8', (err, data) => {
    if (err) {
      res.send('Error reading login data');
    } else {
      const username = data.split('\n').pop().trim();
      const mainHTML = path.join(__dirname, 'main.html');
      fs.readFile(mainHTML, 'utf8', (err, mainData) => {
        if (err) {
          res.send('Error reading main HTML data');
        } else {
          const modifiedMainData = mainData.replace('{username}', username);
          res.send(modifiedMainData);
        }
      });
    }
  });
});







app.post('/follow', (req, res) => {
  const followedUser = req.body.followedUser;
  console.log('Followed User:', followedUser);

  const fs = require('fs');
  const path = require('path');

  const loginFilePath = path.join(__dirname, 'users', 'login.txt');
  let followerUsername = '';

  try {
    followerUsername = fs.readFileSync(loginFilePath, 'utf8').trim();
    console.log('Follower Username:', followerUsername);

    const profilePhotoAbsolutePath = path.join(__dirname, 'users', followerUsername, 'images', 'profile', `${followerUsername}.jpg`);
    const relativePath = path.relative(__dirname, profilePhotoAbsolutePath);
    console.log('Profile Photo Path:', relativePath);

    const followersDir = path.join(__dirname, 'users', followedUser, 'followers');
    console.log('Followers Directory:', followersDir);

    if (!fs.existsSync(followersDir)) {
      try {
        fs.mkdirSync(followersDir, { recursive: true });
      } catch (err) {
        console.error('Error creating followers directory:', err);
        res.status(500).send('Error creating followers directory');
        return;
      }
    }

    const followerData = { username: followerUsername, profilePhoto: relativePath };

    const followerDataFilePath = path.join(followersDir, `${followerUsername}.json`);
    fs.writeFile(followerDataFilePath, JSON.stringify(followerData), (err) => {
      if (err) {
        console.error('Error saving follower data:', err);
        res.status(500).send('Error saving follower data');
      } else {
        console.log('Follower data saved successfully');
        res.send('Follower data saved successfully');
      }
    });
  } catch (err) {
    console.error('Error reading login data:', err);
    res.status(500).send('Error reading login data');
  }
});








app.get('/getFollowersData', (req, res) => {
  const username = req.query.username;
  const followersDir = path.join(__dirname, 'users', username, 'followers');

  if (!fs.existsSync(followersDir)) {
    res.json([]); // Return an empty array if the directory doesn't exist
    return;
  }

  const followersData = [];
  const followerFiles = fs.readdirSync(followersDir);

  followerFiles.forEach(file => {
    const filePath = path.join(followersDir, file);
    const followerData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    followersData.push(followerData);
  });

  res.json(followersData);
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
app.get('/error', (req, res) => {
  res.sendFile(path.join(__dirname, 'error.html'));
});
app.get('/userprofile', (req, res) => {
  res.sendFile(path.join(__dirname, 'userProfile.html'));
});




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
