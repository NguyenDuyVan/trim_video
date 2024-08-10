import ffmpeg, { setFfmpegPath, setFfprobePath, ffprobe } from 'fluent-ffmpeg';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, rmSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';
import async from 'async';

dotenv.config();

const ffmpegPath = 'C:\\ffmpeg\\bin\\ffmpeg.exe';
const ffprobePath = 'C:\\ffmpeg\\bin\\ffprobe.exe';
const rootDirVideo = 'C:\\Users\\Van\\Downloads\\Video';

setFfmpegPath(ffmpegPath);
setFfprobePath(ffprobePath);

const segmentDir = join('output_segments');
const combinedVideoFolder = join('C:', 'Users', 'Van', 'Desktop', 'Source');

const generateOutputFilePath = (fileName = 'combined_video_{sufix}.mp4') => {
  return join(combinedVideoFolder, fileName.replace('{sufix}', new Date().getTime()));
};

const combineVideoFileName = 'combine_list_video.txt';

// Function to generate random numbers
const generateRandomNumbers = (total, segments = 60) => {
  const segmentLength = total / segments;
  return Array.from({ length: segments }, (_, i) => {
    const startSegment = i * segmentLength;
    const endSegment = (i + 1) * segmentLength;
    const min = startSegment;
    const max = endSegment - 3;
    const randomNum = Math.random() * (max - min) + min;
    return Math.round(randomNum * 100) / 100;
  });
};

// Get the duration of the video
const getVideoDuration = (inputVideoPath) => {
  return new Promise((resolve, reject) => {
    ffprobe(inputVideoPath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      resolve(metadata.format.duration);
    });
  });
};

const initializeFolders = () => {
  if (!existsSync(segmentDir)) mkdirSync(segmentDir);
  if (!existsSync(combinedVideoFolder)) mkdirSync(combinedVideoFolder);
};

const createVideoSegment = (inputVideoPath, segment, callback) => {
  const { startTime, outputPath } = segment;
  ffmpeg(inputVideoPath)
    .setStartTime(startTime)
    .setDuration(segment.segmentDuration)
    .videoCodec('h264_amf')
    .output(outputPath)
    .on('end', () => {
      console.log(`Segment created successfully: ${outputPath}`);
      callback(null);
    })
    .on('error', (err) => {
      console.error('Error occurred:', err);
      callback(err);
    })
    .run();
};

const processSegmentsQueue = (inputVideoPath, segments, callback) => {
  const maxConcurrentProcesses = 5; // Adjust based on your system's capability
  const queue = async.queue((segment, cb) => createVideoSegment(inputVideoPath, segment, cb), maxConcurrentProcesses);

  queue.drain(callback);
  segments.forEach((segment, i) => queue.push({ ...segment, segmentDuration: segment.segmentDuration }, (err) => {
    if (err) console.error(`Failed to process segment ${i}:`, err);
  }));
};

const combineSegments = (segmentPaths) => {
  return new Promise((resolve, reject) => {
    const concatList = segmentPaths.map(segment => `file '${segment}'`).join('\n');
    writeFileSync(combineVideoFileName, concatList);

    const draftFileName = generateOutputFilePath('draft_video_{sufix}.mp4');

    ffmpeg()
      .input(combineVideoFileName)
      .inputOptions(['-f concat', '-safe 0'])
      .videoFilters(['crop=in_h*4/3:in_h', 'hflip'])
      .videoCodec('h264_amf')
      .output(draftFileName)
      .on('end', () => {
        console.log('Combined video to 4:3 ratio');
        unlinkSync(combineVideoFileName);
        rmSync(segmentDir, { recursive: true, force: true });
        resolve(draftFileName);
      })
      .on('error', (err) => {
        console.error('Error occurred:', err);
        unlinkSync(combineVideoFileName);
        reject(err);
      })
      .run();
  });
};

const convertToFinalAspectRatio = (draftFileName) => {
  const finalFileName = generateOutputFilePath();
  return new Promise((resolve, reject) => {
    ffmpeg(draftFileName)
      .videoCodec('h264_amf')
      .outputOptions(['-vf', 'pad=iw:ih*9/4:0:(oh-ih)/2'])
      .output(finalFileName)
      .on('end', () => {
        unlinkSync(draftFileName);
        console.log('Final video created successfully');
        resolve(finalFileName);
      })
      .on('error', (err) => {
        console.error('Error during conversion:', err);
        unlinkSync(draftFileName);
        reject(err);
      })
      .run();
  });
};

export const breakVideoToSegments = async (data) => {
  const { segmentDuration, segmentNumber, videoName } = data;
  const inputVideoPath = join(rootDirVideo, videoName);
  
  try {
    const videoDuration = await getVideoDuration(inputVideoPath);
    initializeFolders();
    const randomNumbers = generateRandomNumbers(videoDuration, segmentNumber);

    const segments = randomNumbers.map((startTime, i) => ({
      startTime,
      outputPath: join(segmentDir, `segment_${i}.mp4`),
      segmentDuration
    }));

    await new Promise((resolve, reject) => processSegmentsQueue(inputVideoPath, segments, (err) => {
      if (err) return reject(err);
      resolve();
    }));

    const selectedSegments = segments.map(segment => segment.outputPath);
    const draftFileName = await combineSegments(selectedSegments);
    await convertToFinalAspectRatio(draftFileName);
  } catch (error) {
    console.error('Error in breakVideoToSegments:', error);
  }
};
