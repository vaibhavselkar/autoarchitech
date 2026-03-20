const bcrypt = require('bcryptjs');

async function testBcrypt() {
  try {
    const password = 'password123';
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    console.log('Original password:', password);
    console.log('Hashed password:', hashedPassword);
    
    // Test comparison with correct password
    const isValid = await bcrypt.compare(password, hashedPassword);
    console.log('Password comparison (correct):', isValid);
    
    // Test comparison with wrong password
    const isInvalid = await bcrypt.compare('wrongpassword', hashedPassword);
    console.log('Password comparison (wrong):', isInvalid);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testBcrypt();