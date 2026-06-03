const bcrypt = require('bcrypt');
bcrypt.hash('12345', 10, (err, hash) => {
    console.log("COPIA ESTE HASH:", hash);
});