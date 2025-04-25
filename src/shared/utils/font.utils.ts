import { GlobalFonts } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as https from 'https';
import { join } from 'path';

export const setupFont = async () => {
  const fontDir = join(process.cwd(), 'assets', 'fonts');
  const fontPath = join(fontDir, 'OpenSans-Regular.ttf');

  // Create directory if it doesn't exist
  if (!fs.existsSync(fontDir)) {
    fs.mkdirSync(fontDir, { recursive: true });
  }

  // Check if font already exists
  if (!fs.existsSync(fontPath)) {
    console.log('Downloading font...');

    // Download a free font from Google Fonts
    const fontUrl =
      'https://fonts.gstatic.com/s/opensans/v34/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4gaVc.ttf';

    await new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(fontPath);
      https
        .get(fontUrl, (response) => {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log('Font downloaded successfully');
            resolve();
          });
        })
        .on('error', (err) => {
          fs.unlinkSync(fontPath); // Remove partial file
          reject(err);
        });
    });
  }

  // Register the font
  try {
    GlobalFonts.registerFromPath(fontPath, 'OpenSans');
    console.log('Font registered successfully');
    console.log(
      'Available fonts:',
      GlobalFonts.families.map((f) => f.family).join(', '),
    );
    return true;
  } catch (error) {
    console.error('Error registering font:', error);
    return false;
  }
};
