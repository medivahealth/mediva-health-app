import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class S3Service {
  private client: S3Client;
  private bucket: string;
  private folderPrefix: string;
  private cloudfrontDomain: string;

  constructor(private config: ConfigService) {
    this.client = new S3Client({
      region: this.config.get('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.config.get('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
    this.bucket = this.config.get('S3_BUCKET', 'mediva-ai-assets');
    this.folderPrefix = this.config.get('S3_FOLDER_PREFIX', 'mediva');
    this.cloudfrontDomain = this.config.get(
      'AWS_CLOUDFRONT_DOMAIN',
      '',
    );
  }

  /**
   * Build the full S3 key with the mediva/ folder prefix
   * e.g. mediva/records/abc123.pdf
   */
  private buildKey(subfolder: string, fileName: string): string {
    return `${this.folderPrefix}/${subfolder}/${fileName}`;
  }

  private getPublicUrl(key: string): string {
    // If it's a local file format, route to our backend URL
    if (key.startsWith('local/')) {
      const backendUrl = this.config.get('BACKEND_URL', 'http://192.168.1.3:3000');
      return `${backendUrl}/uploads/${key.replace('local/', '')}`;
    }

    if (this.cloudfrontDomain) {
      return `${this.cloudfrontDomain}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.config.get('AWS_REGION', 'us-east-1')}.amazonaws.com/${key}`;
  }

  async upload(
    file: Buffer,
    originalName: string,
    contentType: string,
    subfolder: string = 'records',
  ): Promise<{ key: string; url: string }> {
    const ext = originalName.split('.').pop() || 'bin';
    const uuid = uuidv4();
    const fileName = `${uuid}.${ext}`;
    const key = this.buildKey(subfolder, fileName);

    const accessKeyId = this.config.get('AWS_ACCESS_KEY_ID', '');
    const secretAccessKey = this.config.get('AWS_SECRET_ACCESS_KEY', '');

    // Fallback to local storage if AWS keys are obviously fake or missing
    if (!accessKeyId || !secretAccessKey || accessKeyId.includes('EXAMPLE') || secretAccessKey.includes('EXAMPLE')) {
      console.log('S3Service: Using local storage fallback for', fileName);
      const localFolder = path.join(process.cwd(), 'uploads', subfolder);
      
      if (!fs.existsSync(localFolder)) {
        fs.mkdirSync(localFolder, { recursive: true });
      }

      const filePath = path.join(localFolder, fileName);
      fs.writeFileSync(filePath, file);

      const localKey = `local/${subfolder}/${fileName}`;
      return { key: localKey, url: this.getPublicUrl(localKey) };
    }

    try {
      const putCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
      });

      await this.client.send(putCommand);

      const url = this.getPublicUrl(key);
      return { key, url };
    } catch (error: any) {
      // Retry without ACL fallback handling
      if (error.name === 'AccessDenied' || error.message?.includes('Access Denied')) {
        throw new Error(
          `S3 upload failed: ${error.message || 'Access Denied'}. ` +
          `Please check AWS credentials.`
        );
      }
      throw error;
    }
  }

  async getObject(key: string): Promise<Buffer> {
    if (key.startsWith('local/')) {
      const cleanPath = key.replace('local/', '');
      const filePath = path.join(process.cwd(), 'uploads', cleanPath);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath);
      }
      throw new Error('Local file not found');
    }

    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    const stream = response.Body as any;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    if (key.startsWith('local/')) {
      const cleanPath = key.replace('local/', '');
      const filePath = path.join(process.cwd(), 'uploads', cleanPath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return;
    }

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}
