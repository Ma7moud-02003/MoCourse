import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { createReadStream } from 'fs';
@Injectable()
export class CloudinaryService {
    constructor(public configService:ConfigService){
        cloudinary.config({
            api_key:configService.get<string>('CLOUDINARY_API_KEY'),
            api_secret:configService.get<string>('CLOUDINARY_API_SECRET'),
            cloud_name:configService.get<string>('CLOUDINARY_NAME')

        })

    }

    /**
     * Upload image
     * @param file 
     * @returns urls
     */
    
public uploadFile(
  file: Express.Multer.File,
  folder: string,
  resourceType: 'image' | 'video' | 'raw' = 'image',
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result as UploadApiResponse);
      },
    );

    Readable.from(file.buffer).pipe(upload);
  });
}


    

    /**
     * Upload a video from a file on disk (chunked, so memory use stays at about one chunk).
     * Returns provider-neutral fields so lesson code never touches Cloudinary types for videos.
     */
    public uploadVideoFromPath(path: string, folder: string): Promise<{ url: string; publicId: string; durationSeconds: number }> {
        return new Promise((resolve, reject) => {
            let input: ReturnType<typeof createReadStream>;
            const out = cloudinary.uploader.upload_chunked_stream(
                { folder, resource_type: 'video' },
                (error, result) => {
                    if (error) {
                        input?.destroy(); // release the file handle on provider failure
                        return reject(error);
                    }
                    const r = result as UploadApiResponse;
                    resolve({ url: r.secure_url, publicId: r.public_id, durationSeconds: Math.round(r.duration) });
                },
            );
            input = createReadStream(path);
            input.on('error', reject);
            input.pipe(out);
        });
    }

    /**
     * Best-effort delete of one asset by its exact public_id. Never throws: a provider problem is only logged,
     * so cleanup can never turn a finished request into an error. Returns true only when the provider said "ok".
     */
    public async destroyAsset(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<boolean> {
        if (!publicId) return false;
        try {
            const res = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
            return res?.result === 'ok';
        } catch (e) {
            console.error('cloudinary cleanup failed for', publicId, e);
            return false;
        }
    }
}
