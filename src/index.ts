import express, { Request, Response } from 'express';
import { config } from 'dotenv';
import { setFfmpegPath, setFfprobePath } from 'fluent-ffmpeg';
import {
  breakVideoToSegments,
  BreakVideoToSegmentsData,
} from './combineRandomSegments';
import path from 'path';
import { asynchronousLoop } from './utils/asynchronousLoop';

config();
const app = express();
const port = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Path to ffmpeg and ffprobe executables
const ffmpegPath = process.env.FFMPEG_PATH;
const ffprobePath = process.env.FFPROBE_PATH;

setFfmpegPath(ffmpegPath);
setFfprobePath(ffprobePath);

// Serve the form
app.get('/', (_req: Request, res: Response) => {
  const indexPath = path.join(__dirname, '..', 'index.html');
  res.sendFile(indexPath);
});

app.get('/success', (_req: Request, res: Response) => {
  const successPath = path.join(__dirname, '..', 'success.html');
  res.sendFile(successPath);
});

// Handle form submission
app.post('/process', async (req: Request, res: Response) => {
  const { videoNames, segmentLongtime, segmentNumber } = req.body;

  try {
    const data: BreakVideoToSegmentsData[] = videoNames.map((item: string) => ({
      videoName: item,
      segmentDuration: segmentLongtime,
      segmentNumber: segmentNumber,
    }));
    asynchronousLoop(data, breakVideoToSegments).then(() => {
      res.redirect('/success');
    });
  } catch (err) {
    console.error('Error processing videos:', err);
    res.status(500).send('Error processing videos');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
