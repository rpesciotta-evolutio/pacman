var service_host = 'localhost'
var auth_details = ''
var mongo_database = 'pacman'
var mongo_port = '27017'
var use_ssl = false
var validate_ssl = true
var connection_details = ''

if(process.env.MONGO_SERVICE_HOST) {
    service_host = process.env.MONGO_SERVICE_HOST
} else if(process.env.MONGO_NAMESPACE_SERVICE_HOST) {
    service_host = process.env.MONGO_NAMESPACE_SERVICE_HOST
}

if(process.env.MONGO_DATABASE) {
    mongo_database = process.env.MONGO_DATABASE
}

if(process.env.MY_MONGO_PORT) {
    mongo_port = process.env.MY_MONGO_PORT
}

if(process.env.MONGO_USE_SSL) {
    if(process.env.MONGO_USE_SSL.toLowerCase() == "true") {
        use_ssl = true
    }
}

if(process.env.MONGO_VALIDATE_SSL) {
    if(process.env.MONGO_VALIDATE_SSL.toLowerCase() == "false") {
        validate_ssl = false
    }
}

if(process.env.MONGO_AUTH_USER && process.env.MONGO_AUTH_PWD) {
    auth_details = `${process.env.MONGO_AUTH_USER}:${process.env.MONGO_AUTH_PWD}@`
}

var hosts = service_host.split(',')

for (let i=0; i<hosts.length;i++) {
  connection_details += `${hosts[i]}:${mongo_port},`
}

connection_details = connection_details.replace(/,\s*$/, "");

var database = {
    url: `mongodb://${auth_details}${connection_details}/${mongo_database}`,
    options: {
        readPreference: 'secondaryPreferred',
        connectTimeoutMS: 5000,         // Time (ms) to wait before a connection attempt times out
        socketTimeoutMS: 5000,          // Time (ms) to wait for a response after connection is established
        serverSelectionTimeoutMS: 5000, // Max time to wait for a suitable server (e.g., when MongoDB is down)
        retryWrites: true,              // Enables retryable writes (safe for idempotent operations)
        maxPoolSize: 10                 // Optional: connection pool size
    }
};

if(process.env.MONGO_REPLICA_SET) {
    database.options.replicaSet = process.env.MONGO_REPLICA_SET
}

if(use_ssl) {
    database.options.ssl = use_ssl
    database.options.sslValidate = validate_ssl
}

exports.database = database;
