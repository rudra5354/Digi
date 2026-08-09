import { supabase } from './supabase';

export const BUCKET_NAME = 'packages';

/**
 * Ensures the private 'packages' storage bucket exists.
 * Creates it with public: false if missing.
 */
export const ensureBucketExists = async (): Promise<boolean> => {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.warn('⚠️ Could not list storage buckets:', listError.message);
      return false;
    }

    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false, // Private bucket: direct public access disallowed
        fileSizeLimit: 52428800, // 50MB max per file limit (50 * 1024 * 1024 bytes)
      });
      if (createError) {
        console.error('❌ Failed to create private storage bucket:', createError.message);
        return false;
      }
      console.log(`✅ Private storage bucket '${BUCKET_NAME}' created successfully.`);
    }

    return true;
  } catch (err: any) {
    console.error('⚠️ Storage bucket check error:', err.message || err);
    return false;
  }
};

/**
 * Uploads a file buffer to the private storage bucket.
 * Path format: packages/{packageId}/{fileId}
 */
export const uploadFileToStorage = async (
  packageId: string,
  fileId: string,
  fileData: Buffer | NodeJS.ReadableStream | ReadableStream | ArrayBuffer | any,
  mimeType: string,
  fileName: string
): Promise<{ filePath: string | null; error: Error | null }> => {
  try {
    // Sanitize file name for path
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const filePath = `${packageId}/${fileId}_${sanitizedFileName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileData, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error('Upload error in storage service:', error.message);
      return { filePath: null, error: new Error(error.message) };
    }

    return { filePath: data.path, error: null };
  } catch (err: any) {
    console.error('Unexpected storage upload error:', err.message || err);
    return { filePath: null, error: err };
  }
};

/**
 * Generates a short-lived, single-session signed URL for downloading a private file.
 * Defaults to 60 seconds validity window.
 */
export const generateSignedDownloadUrl = async (
  filePath: string,
  expiresInSeconds: number = 60
): Promise<{ signedUrl: string | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      console.error('Failed to generate signed download URL:', error?.message);
      return { signedUrl: null, error: new Error(error?.message || 'Signed URL generation failed') };
    }

    return { signedUrl: data.signedUrl, error: null };
  } catch (err: any) {
    console.error('Unexpected signed URL generation error:', err.message || err);
    return { signedUrl: null, error: err };
  }
};

/**
 * Deletes a single file from the private storage bucket.
 */
export const deleteFileFromStorage = async (
  filePath: string
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);

    if (error) {
      console.error('Failed to delete storage file:', error.message);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Unexpected storage delete error:', err.message || err);
    return { success: false, error: err };
  }
};

/**
 * Deletes multiple files from the private storage bucket.
 */
export const deletePackageFilesFromStorage = async (
  filePaths: string[]
): Promise<{ success: boolean; error: Error | null }> => {
  if (!filePaths || filePaths.length === 0) {
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase.storage.from(BUCKET_NAME).remove(filePaths);

    if (error) {
      console.error('Failed to delete package files from storage:', error.message);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Unexpected storage batch delete error:', err.message || err);
    return { success: false, error: err };
  }
};
