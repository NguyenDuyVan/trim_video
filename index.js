import express, { urlencoded, json, static as staticExpress } from 'express';
import { config } from 'dotenv';
import { setFfmpegPath, setFfprobePath } from 'fluent-ffmpeg';
import { breakVideoToSegments } from './combineRandomSegments';
import path from 'path';
import async from 'async';

config();
const app = express();
const port = 3000;

app.use(urlencoded({ extended: true }));
app.use(json());
app.use(staticExpress('public'));

// Path to ffmpeg and ffprobe executables
const ffmpegPath = 'C:\\ffmpeg\\bin\\ffmpeg.exe';
const ffprobePath = 'C:\\ffmpeg\\bin\\ffprobe.exe';

setFfmpegPath(ffmpegPath);
setFfprobePath(ffprobePath);

// Serve the form
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'index.html');
  res.sendFile(indexPath);
});

app.get('/success', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'success.html');
  res.sendFile(indexPath);
});

// Handle form submission
app.post('/process', async (req, res) => {
  const { videoNames, segmentLongtime, segmentNumber } = req.body;
  try {
    await async.eachSeries(videoNames, async (videoName) => {
      await breakVideoToSegments({
        videoName,
        segmentDuration: segmentLongtime,
        segmentNumber: segmentNumber,
      });
    });
    res.redirect('/success');
  } catch (err) {
    console.error('Error processing videos:', err);
    res.status(500).send('Error processing videos');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
