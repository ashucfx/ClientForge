const jose = require('jose');
const fetch = require('node-fetch');

(async () => {
  const secret = process.env.ADMIN_SESSION_SECRET || 'secret';
  const jwt = await new jose.SignJWT({ adminId: '1', email: 'catalyst@theripplenexus.com', role: 'EDITOR', brandAccess: ['catalyst'] })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(new TextEncoder().encode(secret));
  
  const res = await fetch('http://localhost:3000/api/invoices?brandId=catalyst', {
    headers: {
      cookie: `cf_admin=${jwt}`
    }
  });
  
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Data:', data);
})();
