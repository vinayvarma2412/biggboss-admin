import { Injectable } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import imageCompression from 'browser-image-compression';

@Injectable({
  providedIn: 'root'
})
export class ImageUploadService {

  constructor(private storage: AngularFireStorage) { }

  async compressImage(file: File, size: number): Promise<File> {
    const options = {
      maxSizeMB: size,          // Maximum size in MB
      useWebWorker: true,     // Use web worker for faster compression
    };
    try {
      const compressedFile = await imageCompression(file, options);
      console.log('Compressed image size:', compressedFile.size / 1024, 'KB');
      return compressedFile;
    } catch (error) {
      console.error('Error compressing the image:', error);
      throw error;
    }
  }

  async uploadImage(file: File, path: string, size: number): Promise<any> {
    const compressedFile = await this.compressImage(file, size);

    const filePath = `${path}/${Date.now()}_${compressedFile.name}`;
    const fileRef = this.storage.ref(filePath);
    const task = this.storage.upload(filePath, compressedFile);

    // Wait for the upload to complete
    await task.snapshotChanges().toPromise();

    // Get the download URL
    const downloadURL = await fileRef.getDownloadURL().toPromise();
    console.log('File available at', downloadURL);

    return {downloadURL: downloadURL, filePath: filePath};
  }
}