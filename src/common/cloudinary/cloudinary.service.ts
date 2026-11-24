import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
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


    
}