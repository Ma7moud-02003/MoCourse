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

    public uploadFile(file:any):Promise<UploadApiResponse>{
    return new Promise((resolve,rejects)=>{
    const upload=cloudinary.uploader.upload_stream(
        {
            folder:'course'
        },
        (error,result)=>{
            if(error) return rejects(error);
            resolve(result as UploadApiResponse)
        }
    )
    Readable.from(file.buffer).pipe(upload)
})
    }
    
}