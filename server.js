
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

const uri1 = "mongodb+srv://ananthakrishnans0608:ArjunAk1234@spotify1.gqzqg.mongodb.net/music?retryWrites=true&w=majority&appName=spotify1";
mongoose.connect(uri1)
  .then(() => console.log(' MongoDB connected successfully'))
  .catch(err => console.error(' MongoDB connection error:', err));

const UserSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String
}, { collection: 'user' });

// const MusicSchema = new mongoose.Schema({
//   title: String,
//   artist: String,
//   genre: String,
//   file: Buffer, // Store audio file in MongoDB
//   albumCover: Buffer // Store image in MongoDB
// }, { collection: 'music' });
const MusicSchema = new mongoose.Schema({
  title: String,
  artist: String,
  genre: String,
  file: { type: mongoose.Schema.Types.Buffer }, // Ensure it stores binary data
  albumCover: { type: mongoose.Schema.Types.Buffer } // Album cover
}, { collection: 'music' });


const PlaylistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  songs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Music' }]
}, { collection: 'playlist' });

const User = mongoose.model('User', UserSchema);
const Music = mongoose.model('Music', MusicSchema);
const Playlist = mongoose.model('Playlist', PlaylistSchema);

const storage = multer.memoryStorage(); // Store files in memory as buffers
const upload = multer({ storage: storage });


const stream = require('stream');
app.post('/upload-song', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'albumCover', maxCount: 1 }]), async (req, res) => {
  const { title, artist } = req.body;

  if (!title || !artist || !req.files['file']) {
    return res.status(400).json({ message: 'Missing title, artist, or song file' });
  }

  try {
    const newSong = new Music({
      title,
      artist,
      genre: 'Unknown',
      file: req.files['file'][0].buffer, // Store audio file as buffer
      albumCover: req.files['albumCover'] ? req.files['albumCover'][0].buffer : null // Store album cover as buffer
    });

    await newSong.save();
    res.status(201).json({
      message: 'Song uploaded successfully',
      song: {
        _id: newSong._id,
        title: newSong.title,
        artist: newSong.artist,
        genre: newSong.genre
      }
    });
  } catch (err) {
    console.error('Error uploading song:', err);
    res.status(500).json({ message: 'Error uploading song' });
  }
});


app.get('/songs', async (req, res) => {
  try {
    const songs = await Music.find(); // Get all songs from the database
    res.status(200).json(songs);
  } catch (err) {
    console.error('Error fetching songs:', err);
    res.status(500).json({ message: 'Server error' });
  }
});





// POST /register
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });

    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    res.status(200).json({ message: 'Login successful' });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /playlists
app.post('/playlists', async (req, res) => {
  const { name, userId } = req.body;

  try {
    const newPlaylist = new Playlist({ userId, name, songs: [] });
    await newPlaylist.save();
    res.status(201).json(newPlaylist);
  } catch (err) {
    console.error('Error creating playlist:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /playlists
app.get('/playlists', async (req, res) => {
  const { userId } = req.query;

  try {
    const playlists = await Playlist.find({ userId }).populate('songs');
    res.status(200).json(playlists);
  } catch (err) {
    console.error('Error fetching playlists:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /playlists/:playlistId/songs
app.post('/playlists/:playlistId/songs', async (req, res) => {
  const { playlistId } = req.params;
  const { songId } = req.body;

  if (!songId) return res.status(400).json({ message: 'songId is required' });

  try {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });

    if (playlist.songs.includes(songId)) {
      return res.status(400).json({ message: 'Song already exists in the playlist' });
    }

    playlist.songs.push(songId);
    await playlist.save();
    res.status(200).json(playlist);
  } catch (err) {
    console.error('Error adding song to playlist:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
 app.delete('/playlists/:playlistId/songs/:songId', async (req, res) => {
    const { playlistId, songId } = req.params;
    try {
      const playlist = await Playlist.findById(playlistId);
      if (!playlist) {
        return res.status(404).json({ success: false, message: 'Playlist not found' });
      }
      const songObjectId = new mongoose.Types.ObjectId(songId);
      playlist.songs = playlist.songs.filter(song => song && song.toString() !== songObjectId.toString());
      await playlist.save();
      res.status(200).json({ success: true, updatedPlaylist: playlist });
    } catch (err) {
      console.error('Error removing song from playlist:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
  
  app.delete('/playlists/:playlistId', async (req, res) => {
    try {
      const { playlistId } = req.params;
      const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId);
      if (!deletedPlaylist) {
        return res.status(404).json({ success: false, message: 'Playlist not found' });
      }
      res.json({ success: true, message: 'Playlist deleted successfully' });
    } catch (err) {
      console.error('Error deleting playlist:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
  app.get('/album-cover/:id', async (req, res) => {
    try {
      const song = await Music.findById(req.params.id);
      if (!song || !song.albumCover) {
        return res.status(404).json({ message: 'Album cover not found' });
      }
  
      res.set('Content-Type', 'image/jpeg'); // Set response header
      res.send(song.albumCover); // Send image binary data
    } catch (err) {
      console.error('Error fetching album cover:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });
app.listen(3000, () => console.log('Server running on port 3000'));
