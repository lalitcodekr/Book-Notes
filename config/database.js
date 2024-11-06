const isProduction = process.env.NODE_ENV === 'production';

const connectionConfig = {
    development: {
        user: 'your_username',
        host: 'your_host',
        database: 'your_database',
        password: 'your_password',
        port: 5432,
        ssl: false
    },
    production: {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    }
};

module.exports = connectionConfig[isProduction ? 'production' : 'development']; 