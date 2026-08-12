import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const db = new PrismaClient();

async function run() {
  const file = await db.careerDeliverable.findFirst({
    where: { mimeType: { contains: 'pdf' } }
  });
  if (!file) {
    console.log('No pdf file found');
    return;
  }
  
  const API_SECRET = 'HsP8Xmj4uZgmfrDOd9ieff3A5oY';
  const fileUrl = file.fileUrl;
  console.log('File URL:', fileUrl);
  
  const uploadIdx = fileUrl.indexOf('/upload/');
  const afterUpload = fileUrl.substring(uploadIdx + '/upload/'.length);
  const publicIdWithFormat = afterUpload.replace(/^v\d+\//, '');
  
  // Test SHA-256
  const str256 = publicIdWithFormat + API_SECRET;
  const sig256 = crypto.createHash('sha256').update(str256).digest('base64url').substring(0, 8);
  const url256 = fileUrl.replace('/upload/', '/upload/s--' + sig256 + '--/');
  
  // Test SHA-1
  const str1 = publicIdWithFormat + API_SECRET;
  const sig1 = crypto.createHash('sha1').update(str1).digest('base64url').substring(0, 8);
  const url1 = fileUrl.replace('/upload/', '/upload/s--' + sig1 + '--/');
  
  console.log('Fetching SHA-256 URL...');
  const res256 = await fetch(url256);
  console.log('SHA-256 status:', res256.status);
  
  console.log('Fetching SHA-1 URL...');
  const res1 = await fetch(url1);
  console.log('SHA-1 status:', res1.status);
}

run().catch(console.error).finally(() => db.$disconnect());
