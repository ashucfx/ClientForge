import * as jose from 'jose';

(async () => {
  const secret = 'a23014f58935f0c37345d61e380644b8bd9ac599315eb263c7422d8a699b7edf85e1438db0e54954';
  const jwt = await new jose.SignJWT({ adminId: 'cmpqca9ui0000pz62t2f7x6kz', email: 'catalyst@theripplenexus.com', role: 'EDITOR', brandAccess: ['catalyst'] })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(new TextEncoder().encode(secret));
  
  const res = await fetch('http://localhost:3000/api/invoices?limit=200&brandId=catalyst', {
    headers: {
      cookie: `cf_admin=${jwt}`
    }
  });
  
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Data:', text.slice(0, 500));
})();
