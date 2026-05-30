import * as jose from 'jose';

(async () => {
  const secret = 'a23014f58935f0c37345d61e380644b8bd9ac599315eb263c7422d8a699b7edf85e1438db0e54954';
  const jwt = await new jose.SignJWT({ adminId: 'cmpqca9ui0000pz62t2f7x6kz', email: 'catalyst@theripplenexus.com', role: 'EDITOR', brandAccess: ['catalyst'] })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(new TextEncoder().encode(secret));
    
  const { payload } = await jose.jwtVerify(jwt, new TextEncoder().encode(secret));
  console.log('Decoded Payload:', payload);
})();
