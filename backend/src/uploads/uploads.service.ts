import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { CreateCloudinarySignatureDto } from './dto/create-cloudinary-signature.dto';

export interface CloudinarySignatureResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  uploadUrl: string;
}

@Injectable()
export class UploadsService {
  createExpenseImageSignature(
    dto: CreateCloudinarySignatureDto = {},
  ): CloudinarySignatureResponse {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    if (!cloudName || !apiKey || !apiSecret) {
      throw new InternalServerErrorException(
        'Cloudinary integration is not configured on this server.',
      );
    }

    const defaultFolder =
      process.env.CLOUDINARY_UPLOAD_FOLDER?.trim() || 'zirba/expenses';
    const folder = dto.folder?.trim() || defaultFolder;
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `expense_${timestamp}_${randomUUID().slice(0, 8)}`;

    const paramsToSign = this.serializeSignatureParams({
      folder,
      public_id: publicId,
      timestamp,
    });
    const signature = createHash('sha1')
      .update(`${paramsToSign}${apiSecret}`)
      .digest('hex');

    return {
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder,
      publicId,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    };
  }

  private serializeSignatureParams(
    params: Record<string, string | number | undefined>,
  ): string {
    return Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }
}
