const jose = require('jose');
(async () => {
  const jwt = await new jose.SignJWT({ adminId: '1', email: 'a', role: 'b', brandAccess: ['c'] })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(new TextEncoder().encode('secret'));
  const { payload } = await jose.jwtVerify(jwt, new TextEncoder().encode('secret'));
  console.log(payload);
})();
