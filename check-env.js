require('dotenv').config();

console.log('🔍 Environment Variables Check:');
console.log('================================');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('MONGODB_URI_PROD exists:', !!process.env.MONGODB_URI_PROD);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('PORT:', process.env.PORT);
console.log('Current working directory:', process.cwd());
console.log('================================');

if (!process.env.MONGODB_URI && !process.env.MONGODB_URI_PROD) {
  console.error('❌ No MongoDB URI found!');
  console.log('Available environment variables:');
  Object.keys(process.env)
    .filter(key => key.includes('MONGO') || key.includes('DB'))
    .forEach(key => console.log(`  ${key}: ${!!process.env[key]}`));
} else {
  console.log('✅ MongoDB URI found!');
}
