const fs = require("fs");
const path = require("path");

// Sample SRT content for testing
const sampleSRT = `1
00:00:01,000 --> 00:00:05,000
Hello! This is a test subtitle.

2
00:00:05,001 --> 00:00:10,000
If you can see this, subtitles are working!

3
00:00:10,001 --> 00:00:15,000
You can replace this with your actual subtitle content.

4
00:00:15,001 --> 00:00:20,000
Just make sure the file is in the same folder as your video.

5
00:00:20,001 --> 00:00:25,000
And that it follows the naming convention.
`;

function createTestSubtitle(videoFilePath) {
  try {
    const parsedPath = path.parse(videoFilePath);
    const subtitlePath = path.join(parsedPath.dir, `${parsedPath.name}_en.srt`);

    fs.writeFileSync(subtitlePath, sampleSRT, "utf8");
    console.log(`✅ Created test subtitle file: ${subtitlePath}`);
    return subtitlePath;
  } catch (error) {
    console.error("❌ Error creating subtitle file:", error);
    return null;
  }
}

// Example usage:
// Replace this with the actual path to one of your video files
const exampleVideoPath = "/path/to/your/video/file.mp4";

if (process.argv[2]) {
  const videoPath = process.argv[2];
  createTestSubtitle(videoPath);
} else {
  console.log("Usage: node test-subtitle-creator.js '/path/to/your/video.mp4'");
  console.log(
    "This will create a test subtitle file with the name: video_en.srt"
  );
}

module.exports = { createTestSubtitle };
