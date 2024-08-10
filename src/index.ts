import express, { Request, Response } from 'express';
import { config } from 'dotenv';
import { setFfmpegPath, setFfprobePath } from 'fluent-ffmpeg';
import { breakVideoToSegments } from './combineRandomSegments';
import path from 'path';
import async from 'async';

config();
const app = express();
const port = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Path to ffmpeg and ffprobe executables
const ffmpegPath =  process.env.FFMPEG_PATH
const ffprobePath =  process.env.FFPROBE_PATH

setFfmpegPath(ffmpegPath);
setFfprobePath(ffprobePath);

// Serve the form
app.get('/', (req: Request, res: Response) => {
  const indexPath = path.join(__dirname, '..', 'index.html');
  res.sendFile(indexPath);
});

app.get('/success', (req: Request, res: Response) => {
  const successPath = path.join(__dirname, '..', 'success.html');
  res.sendFile(successPath);
});

// Handle form submission
app.post('/process', async (req: Request, res: Response) => {
  const { videoNames, segmentLongtime, segmentNumber } = req.body;

  if (!Array.isArray(videoNames) || typeof segmentLongtime !== 'number' || typeof segmentNumber !== 'number') {
    return res.status(400).send('Invalid request data');
  }

  try {
    await async.eachSeries(videoNames, async (videoName: string) => {
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
