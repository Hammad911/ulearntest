import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const indexName = formData.get('indexName') as string;
    
    if (!file || !indexName) {
      return NextResponse.json(
        { error: 'File and index name are required' },
        { status: 400 }
      );
    }

    // Validate index name format
    if (!/^[a-z0-9-]+$/.test(indexName)) {
      return NextResponse.json(
        { error: 'Index name must contain only lowercase letters, numbers, and hyphens' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create uploads directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'uploads');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (error) {
      console.error('Error creating uploads directory:', error);
    }

    // Save the file temporarily
    const filePath = join(uploadDir, file.name);
    await writeFile(filePath, buffer);

    // Get the absolute path to the Python script
    const scriptPath = join(process.cwd(), 'bookembedder.py');

    // Run the Python script with the file path and index name
    const pythonProcess = spawn('python', [scriptPath, filePath, indexName]);

    let output = '';
    let error = '';
    let chunksProcessed = 0;
    let totalChunks = 0;

    pythonProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      output += dataStr;
      console.log('Python stdout:', dataStr);
      
      // Parse progress updates from Python script
      try {
        const progressMatch = dataStr.match(/Progress: (\d+)\/(\d+) chunks/);
        if (progressMatch) {
          chunksProcessed = parseInt(progressMatch[1]);
          totalChunks = parseInt(progressMatch[2]);
        }
      } catch (e) {
        console.error('Error parsing progress:', e);
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
      console.error('Python stderr:', data.toString());
    });

    return new Promise((resolve) => {
      pythonProcess.on('close', (code) => {
        console.log('Python process exited with code:', code);
        console.log('Output:', output);
        console.log('Error:', error);

        if (code !== 0) {
          resolve(NextResponse.json(
            { 
              error: 'Python script failed',
              details: error || 'Unknown error occurred',
              output,
              progress: {
                chunksProcessed,
                totalChunks,
                percentage: totalChunks > 0 ? (chunksProcessed / totalChunks) * 100 : 0
              }
            },
            { status: 500 }
          ));
        } else {
          resolve(NextResponse.json(
            { 
              message: 'File processed successfully',
              output,
              progress: {
                chunksProcessed,
                totalChunks,
                percentage: 100
              }
            },
            { status: 200 }
          ));
        }
      });

      pythonProcess.on('error', (err) => {
        console.error('Error spawning Python process:', err);
        resolve(NextResponse.json(
          { 
            error: 'Failed to start Python process',
            details: err.message,
            progress: {
              chunksProcessed,
              totalChunks,
              percentage: 0
            }
          },
          { status: 500 }
        ));
      });
    });
  } catch (error) {
    console.error('Error in upload route:', error);
    return NextResponse.json(
      { 
        error: 'Error processing file',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
        progress: {
          chunksProcessed: 0,
          totalChunks: 0,
          percentage: 0
        }
      },
      { status: 500 }
    );
  }
} 